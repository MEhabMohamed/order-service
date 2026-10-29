import {injectable, inject} from "tsyringe";
import {TOKENS} from "../../../lib/di/tokens";
import {db} from "../../../lib/knex/knex";
import {logger} from "../../../lib/logger/logger";
import {fromMinor, sumMinor} from "../../../pkg/utils/money";
import {toMs} from "../../../pkg/utils/time";
import {env} from "../../../lib/config/env";
import {IPaymentProvider} from "../../../pkg/payments/payment.interface";
import {OrderEntity} from "../../order/entity/order.entity";
import {findOrderById, findOrderByPublicId} from "../../order/repository/order.repo";
import {OrderNotFoundError} from "../../order/errors";
import {UnAuthorisedError} from "../../../lib/auth/errors";
import {AppError} from "../../../lib/error/AppError";
import {
    createSession,
    findActiveSessionByOrderId,
    findLatestSessionByOrderId,
} from "../repository/payment-session.repo";
import {
    createTransaction,
    findTransactionById,
    findTransactionWithRestaurant,
    findSuccessfulRefundsByOrderId,
    findChargeTransactionByOrderId,
    findTransactionsByOrderIds,
    updateTransaction,
} from "../repository/transaction.repo";
import {PaymentSessionEntity} from "../entity/payment-session.entity";
import {
    PaymentSessionStatus,
    PaymentProviderName,
    PAYMENT_PROVIDER_IDS,
    TransactionType,
    TransactionMethod,
    TransactionStatus,
} from "../enums";
import {PaymentInitResponseDTO, PaymentResponseDTO} from "../dto/payment.response.dto";
import {RefundRequestDTO, RefundResponseDTO} from "../dto/refund.dto";
import {
    PaymentNotFoundError,
    PaymentProviderUnavailableError,
    InvalidPaymentStatusForRefundError,
    PaymentAlreadyRefundedError,
    RefundExceedsChargeAmountError,
} from "../errors";

interface InitOnlinePaymentResult {
    session: PaymentSessionEntity;
    expiresAt: string;
    dto: PaymentInitResponseDTO;
}

@injectable()
export class PaymentService {
    constructor(@inject(TOKENS.KashierProvider) private readonly kashier: IPaymentProvider) {}

    /**
     * Called from OrderService.placeOrder for online orders, AFTER the order
     * row has been committed.
     *
     * Idempotent at the domain level: if an active session exists for this
     * order (initialized/pending), we return its redirectUrl rather than
     * minting a second one.
     */
    async initOnlinePayment(order: OrderEntity): Promise<InitOnlinePaymentResult> {
        const conn = db(order.region);
        const sessionTtlMs = toMs.minute(env.payments.sessionTimeoutMin);

        const existing = await findActiveSessionByOrderId(order.id, conn);
        if (existing) {
            // Session already alive — surface it as-is. Kashier's iframe enforces its own expireAt.
            const expiresAt = new Date(existing.createdAt.getTime() + sessionTtlMs).toISOString();
            return {
                session: existing,
                expiresAt,
                dto: PaymentInitResponseDTO.from(existing, expiresAt),
            };
        }

        let providerResp;
        try {
            providerResp = await this.kashier.createSession({
                merchantOrderId: order.publicId,
                amount: fromMinor(order.total).toFixed(2),
                currency: order.currency,
                description: `QuickBite order ${order.publicId}`,
                allowedMethods: "card,wallet",
                customerReference: String(order.customerId),
            });
        } catch (err) {
            logger.error("kashier createSession failed", {
                orderPublicId: order.publicId,
                error: (err as Error).message,
            });
            throw PaymentProviderUnavailableError;
        }

        const session = await createSession({
            region: order.region,
            orderId: order.id,
            orderCreatedAt: order.createdAt,
            providerId: PAYMENT_PROVIDER_IDS[PaymentProviderName.KASHIER],
            providerSessionId: providerResp.providerSessionId,
            redirectUrl: providerResp.redirectUrl,
            amount: order.total,
            currency: order.currency,
            status: PaymentSessionStatus.INITIALIZED,
            rawInitPayload: providerResp.rawResponse,
        }, conn);

        const expiresAt = providerResp.expiresAt
            ?? new Date(Date.now() + sessionTtlMs).toISOString();

        return {
            session,
            expiresAt,
            dto: PaymentInitResponseDTO.from(session, expiresAt),
        };
    }

    /**
     * GET /restaurants/:restaurantId/payments/:paymentId.
     *
     * Auth split between layers:
     *   - middleware (`requireRestaurantMember` + `rbac`) gates the request to
     *     members of the restaurant in the URL with `payments:read`;
     *     `system_admin` bypasses both.
     *   - this method just enforces "the payment actually belongs to that
     *     restaurant" so a member can't peek into a sibling restaurant by id.
     *
     * Single SQL via JOIN — no N+1.
     */
    async getById(paymentId: number, restaurantId: number, region: string): Promise<PaymentResponseDTO> {
        const conn = db(region);
        const found = await findTransactionWithRestaurant(paymentId, conn);
        if (!found) throw PaymentNotFoundError;

        if (found.restaurantId !== null && found.restaurantId !== restaurantId) {
            // The middleware verified the caller's right to see "restaurantId",
            // but the transaction belongs to a different restaurant.
            throw UnAuthorisedError;
        }

        return PaymentResponseDTO.from(found.transaction);
    }

    /**
     * POST /payments/:paymentId/refund
     *
     * Admin-only refund execution.
     * Validates that paymentId is a succeeded charge, calculates remaining
     * refundable balance, writes a pending refund transaction to the ledger,
     * calls Kashier refund API, and returns RefundResponseDTO.
     * When Kashier confirms via webhook, reconcileRefund flips status to succeeded.
     */
    async refund(
        paymentId: number,
        dto: RefundRequestDTO,
        region: string,
        idempotencyKey?: string,
    ): Promise<RefundResponseDTO> {
        const conn = db(region);

        const charge = await findTransactionById(paymentId, conn);
        if (!charge) throw PaymentNotFoundError;

        if (charge.transactionType !== TransactionType.CHARGE || charge.status !== TransactionStatus.SUCCEEDED) {
            throw InvalidPaymentStatusForRefundError;
        }

        if (charge.isRefunded) {
            throw PaymentAlreadyRefundedError;
        }

        if (!charge.orderId) {
            throw new AppError("Payment is not tied to an order", 400);
        }

        const order = await findOrderById(charge.orderId, conn);
        if (!order) throw new AppError("Order not found", 404);

        const existingRefunds = await findSuccessfulRefundsByOrderId(order.id, conn);
        const alreadyRefunded = sumMinor(existingRefunds.map((r) => r.amount));
        const remainingRefundable = charge.amount - alreadyRefunded;

        if (remainingRefundable <= 0) {
            throw PaymentAlreadyRefundedError;
        }

        const refundAmountMinor = dto.amount ?? remainingRefundable;
        if (refundAmountMinor <= 0 || refundAmountMinor > remainingRefundable) {
            throw RefundExceedsChargeAmountError;
        }

        if (charge.method === TransactionMethod.ONLINE) {
            const session = await findLatestSessionByOrderId(order.id, conn);
            const kashierOrderId = (session?.rawLastPayload as any)?.data?.kashierOrderId
                ?? (session?.rawInitPayload as any)?._id
                ?? charge.providerReferenceId
                ?? order.publicId;

            const refundTx = await createTransaction({
                region,
                orderId: order.id,
                transactionType: TransactionType.REFUND,
                method: TransactionMethod.ONLINE,
                providerId: PAYMENT_PROVIDER_IDS[PaymentProviderName.KASHIER],
                providerReferenceId: null,
                status: TransactionStatus.PENDING,
                amount: refundAmountMinor,
                currency: charge.currency,
                srcAccId: null,
                dstAccId: order.customerId,
                idempotencyKey: idempotencyKey || `refund:${paymentId}:${Date.now()}`,
            }, conn);

            try {
                const kashierRes = await this.kashier.refund({
                    kashierOrderId,
                    targetTransactionId: charge.providerReferenceId || undefined,
                    amount: fromMinor(refundAmountMinor).toFixed(2),
                    currency: charge.currency,
                    reason: dto.reason,
                });

                if (kashierRes.providerRefundId) {
                    await updateTransaction(refundTx.id, {
                        status: TransactionStatus.PENDING,
                    }, conn);
                }
            } catch (err) {
                const errMsg = (err as Error).message;
                logger.error("kashier refund API call failed", {
                    paymentId,
                    orderPublicId: order.publicId,
                    error: errMsg,
                });
                await updateTransaction(refundTx.id, {
                    status: TransactionStatus.FAILED,
                }, conn);
                if (errMsg.includes("fully refunded") || errMsg.includes("already refunded")) {
                    throw PaymentAlreadyRefundedError;
                }
                throw PaymentProviderUnavailableError;
            }

            return RefundResponseDTO.from(refundTx);
        } else {
            // Offline / COD refund bookkeeping
            const refundTx = await createTransaction({
                region,
                orderId: order.id,
                transactionType: TransactionType.REFUND,
                method: charge.method,
                providerId: null,
                providerReferenceId: null,
                status: TransactionStatus.SUCCEEDED,
                amount: refundAmountMinor,
                currency: charge.currency,
                srcAccId: null,
                dstAccId: order.customerId,
                idempotencyKey: idempotencyKey || `refund:${paymentId}:${Date.now()}`,
            }, conn);

            const isFullyRefunded = (alreadyRefunded + refundAmountMinor) >= charge.amount;
            await updateTransaction(charge.id, {
                isRefunded: isFullyRefunded,
                refundedPaymentId: refundTx.id,
            }, conn);

            return RefundResponseDTO.from(refundTx);
        }
    }

    /**
     * Admin-only lookup: get transaction ID and payment details by order publicId.
     */
    async getByOrderPublicId(publicId: string, region: string) {
        const conn = db(region);
        const order = await findOrderByPublicId(publicId, conn);
        if (!order) throw OrderNotFoundError;

        const charge = await findChargeTransactionByOrderId(order.id, conn);
        const allTransactions = await findTransactionsByOrderIds([order.id], conn);

        return {
            orderPublicId: order.publicId,
            orderId: order.id,
            paymentId: charge ? charge.id : null,
            charge: charge ? PaymentResponseDTO.from(charge) : null,
            transactions: allTransactions.map(PaymentResponseDTO.from),
        };
    }
}
