import { injectable } from "tsyringe";
import { db } from "../../../lib/knex/knex";
import { env } from "../../../lib/config/env";
import { toMs } from "../../../pkg/utils/time";
import { kashierClient } from "../../../pkg/payments/kashier/kashier.client";
import { OrderNotFoundError, UnauthorizedOrderAccessError } from "../../orders/errors";
import { OrderStatus } from "../../orders/enums";
import { findOrderById, findOrderByPublicId } from "../../orders/repository/order.repo";
import { InitPaymentRequestDTO } from "../dto/init-payment.dto";
import { PaymentInitResponseDTO, PaymentResponseDTO, RefundResponseDTO } from "../dto/payment-response.dto";
import { RefundRequestDTO } from "../dto/refund-request.dto";
import {
    PaymentProviderName,
    PaymentSessionStatus,
    TransactionMethod,
    TransactionStatus,
    TransactionType,
} from "../enums";
import {
    InvalidRefundAmountError,
    OrderNotPendingPaymentError,
    PaymentAlreadyRefundedError,
    PaymentNotFoundError,
    UnsupportedPaymentProviderError,
} from "../errors";
import { findProviderByName } from "../repository/payment-provider.repo";
import {
    createPaymentSession,
    findActiveSessionByOrderId,
} from "../repository/payment-session.repo";
import {
    createTransaction,
    findTransactionById,
    sumRefundsForPayment,
} from "../repository/transaction.repo";

export interface AuthUser {
    userId: number;
    role: string;
    email: string;
    restaurantId?: number;
    restaurantRole?: string;
    branchIds?: number[];
}

@injectable()
export class PaymentService {
    async init(
        customerId: number,
        region: string,
        data: InitPaymentRequestDTO
    ): Promise<PaymentInitResponseDTO> {
        const conn = db(region);
        const order = await findOrderByPublicId(data.orderId, conn);
        if (!order) {
            throw new OrderNotFoundError();
        }

        if (order.customerId !== customerId) {
            throw new UnauthorizedOrderAccessError();
        }

        if (order.status !== OrderStatus.PENDING_PAYMENT) {
            throw new OrderNotPendingPaymentError(order.status);
        }

        // 1. Idempotency check at domain level
        const existingSession = await findActiveSessionByOrderId(order.id!, conn);
        if (existingSession) {
            return {
                sessionId: existingSession.id,
                providerSessionId: existingSession.providerSessionId,
                redirectUrl: existingSession.redirectUrl,
                expiresAt: new Date(
                    existingSession.createdAt.getTime() + toMs.minute(env.kashier.sessionTimeoutMin)
                ).toISOString(),
                amount: existingSession.amount,
                currency: existingSession.currency,
            };
        }

        // 2. Obtain Kashier provider ID
        const provider = await findProviderByName(PaymentProviderName.KASHIER, conn);
        if (!provider) {
            throw new UnsupportedPaymentProviderError(PaymentProviderName.KASHIER);
        }

        // 3. Create Kashier v3 session
        const kashierResult = await kashierClient.createSession({
            orderPublicId: order.publicId,
            amount: order.total,
            currency: order.currency,
            allowedMethods: "card,wallet",
            defaultMethod: "card",
            description: `QuickBite Order ${order.publicId}`,
        });

        // 4. Save session in database
        const session = await createPaymentSession(
            {
                region,
                orderId: order.id!,
                orderCreatedAt: order.createdAt!,
                providerId: provider.id,
                providerSessionId: kashierResult.sessionId,
                redirectUrl: kashierResult.sessionUrl,
                amount: order.total,
                currency: order.currency,
                status: PaymentSessionStatus.INITIALIZED,
                rawInitPayload: kashierResult.rawResponse,
            },
            conn
        );

        return {
            sessionId: session.id,
            providerSessionId: session.providerSessionId,
            redirectUrl: session.redirectUrl,
            expiresAt: new Date(Date.now() + toMs.minute(env.kashier.sessionTimeoutMin)).toISOString(),
            amount: session.amount,
            currency: session.currency,
        };
    }

    async getById(
        user: AuthUser,
        region: string,
        paymentId: number
    ): Promise<PaymentResponseDTO> {
        const conn = db(region);
        const tx = await findTransactionById(paymentId, conn);
        if (!tx) {
            throw new PaymentNotFoundError(paymentId);
        }

        // Authorization check
        if (user.role !== "system_admin") {
            // Restaurant owner can view only their own restaurant payments
            if (tx.dstAccId !== user.userId) {
                throw new UnauthorizedOrderAccessError();
            }
        }

        let orderPublicId: string | undefined;
        if (tx.orderId) {
            const order = await findOrderById(tx.orderId, conn);
            orderPublicId = order?.publicId;
        }

        return {
            id: tx.id,
            orderPublicId,
            type: tx.transactionType,
            method: tx.method,
            provider: tx.providerId === 1 ? "kashier" : undefined,
            providerReferenceId: tx.providerReferenceId,
            status: tx.status,
            amount: tx.amount,
            currency: tx.currency,
            isRefunded: tx.isRefunded,
            refundedPaymentId: tx.refundedPaymentId || undefined,
            createdAt: tx.createdAt.toISOString(),
            updatedAt: tx.updatedAt.toISOString(),
        };
    }

    async refund(
        adminUser: AuthUser,
        region: string,
        paymentId: number,
        data: RefundRequestDTO
    ): Promise<RefundResponseDTO> {
        const conn = db(region);
        const tx = await findTransactionById(paymentId, conn);
        if (!tx) {
            throw new PaymentNotFoundError(paymentId);
        }

        if (tx.transactionType !== TransactionType.CHARGE || tx.status !== TransactionStatus.SUCCEEDED) {
            throw new InvalidRefundAmountError("Only succeeded charges can be refunded");
        }

        if (tx.isRefunded) {
            throw new PaymentAlreadyRefundedError();
        }

        const alreadyRefunded = await sumRefundsForPayment(paymentId, conn);
        const remainingRefundable = tx.amount - alreadyRefunded;
        const refundAmount = data.amount ?? remainingRefundable;

        if (refundAmount <= 0 || refundAmount > remainingRefundable) {
            throw new InvalidRefundAmountError(
                `Requested refund (${refundAmount}) exceeds refundable balance (${remainingRefundable})`
            );
        }

        let refundTxId = 0;

        await conn.transaction(async (trx) => {
            const refundTx = await createTransaction(
                {
                    region,
                    orderId: tx.orderId,
                    orderCreatedAt: tx.orderCreatedAt,
                    transactionType: TransactionType.REFUND,
                    method: tx.method,
                    providerId: tx.providerId,
                    status: TransactionStatus.PENDING,
                    amount: refundAmount,
                    currency: tx.currency,
                    srcAccId: null,
                    dstAccId: tx.srcAccId,
                    isRefunded: false,
                    refundedPaymentId: tx.id,
                    idempotencyKey: `refund_${paymentId}_${Date.now()}`,
                },
                trx
            );

            refundTxId = refundTx.id;

            // If payment was online via Kashier, call Kashier refund API
            if (tx.method === TransactionMethod.ONLINE && tx.providerReferenceId) {
                await kashierClient.refund({
                    transactionId: tx.providerReferenceId,
                    amount: refundAmount,
                    currency: tx.currency,
                    reason: data.reason,
                });
            }
        });

        return {
            refundId: refundTxId,
            status: TransactionStatus.PENDING,
            amount: refundAmount,
            currency: tx.currency,
        };
    }
}
