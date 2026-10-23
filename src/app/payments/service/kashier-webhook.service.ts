import { injectable } from "tsyringe";
import { container } from "../../../lib/di/container";
import { TOKENS } from "../../../lib/di/tokens";
import { db } from "../../../lib/knex/knex";
import { redisClient } from "../../../lib/cache/init";
import { kashierClient } from "../../../pkg/payments/kashier/kashier.client";
import { env } from "../../../lib/config/env";
import { OrderStatus } from "../../orders/enums";
import { findOrderByPublicId, updateOrderStatus } from "../../orders/repository/order.repo";
import { PaymentProviderName, PaymentSessionStatus, TransactionMethod, TransactionStatus, TransactionType } from "../enums";
import { InvalidSignatureError, UnsupportedPaymentProviderError } from "../errors";
import { findProviderByName } from "../repository/payment-provider.repo";
import { findSessionByProviderSessionId, updatePaymentSessionStatus } from "../repository/payment-session.repo";
import { createTransaction, findTransactionByProviderReference, updateTransactionStatus } from "../repository/transaction.repo";
import { markWebhookEventProcessed, tryRecordWebhookEvent } from "../repository/payment-webhook-event.repo";

@injectable()
export class KashierWebhookService {
    private emitWs(room: string, event: string, payload: any) {
        try {
            if (container.isRegistered(TOKENS.WsServer)) {
                const io = container.resolve<any>(TOKENS.WsServer);
                if (io) {
                    io.to(room).emit(event, payload);
                }
            }
        } catch {}
    }

    async handleWebhook(
        providerName: string,
        signature: string,
        payload: any,
        explicitRegion?: string
    ): Promise<{ acknowledged: boolean; duplicate?: boolean }> {
        if (providerName !== PaymentProviderName.KASHIER) {
            throw new UnsupportedPaymentProviderError(providerName);
        }

        const isValid = kashierClient.verifyWebhookSignature(signature, payload);
        if (!isValid) {
            throw new InvalidSignatureError();
        }

        const eventType = payload.event; // 'pay', 'capture', 'refund', etc.
        const data = payload.data || {};
        const providerEventId =
            data.transactionId ||
            data.kashierOrderId ||
            `${eventType}_${data.orderReference || data.order || Date.now()}`;

        // Discover target region: from explicitRegion, or from order public_id, or by scanning shards
        const orderPublicId = data.order || data.orderReference || data.merchantOrderId;
        let targetRegion = explicitRegion;

        if (!targetRegion && orderPublicId) {
            for (const r of env.regions) {
                const found = await findOrderByPublicId(orderPublicId, db(r));
                if (found) {
                    targetRegion = r;
                    break;
                }
            }
        }

        if (!targetRegion) {
            targetRegion = env.regions[0]; // fallback to primary region
        }

        const conn = db(targetRegion);
        const provider = await findProviderByName(PaymentProviderName.KASHIER, conn);
        if (!provider) {
            throw new UnsupportedPaymentProviderError(providerName);
        }

        // Deduplication using ON CONFLICT (provider_id, provider_event_id) DO NOTHING
        const isFresh = await tryRecordWebhookEvent(
            {
                region: targetRegion,
                providerId: provider.id,
                providerEventId,
                signature,
                payload,
            },
            conn
        );

        if (!isFresh) {
            return { acknowledged: true, duplicate: true };
        }

        try {
            await conn.transaction(async (trx) => {
                // Find matching payment session
                const providerSessionId = data.kashierOrderId || data.order;
                let session = providerSessionId
                    ? await findSessionByProviderSessionId(providerSessionId, trx)
                    : null;

                const order = orderPublicId
                    ? await findOrderByPublicId(orderPublicId, trx)
                    : null;

                const amountMinor = data.amount
                    ? Math.round(Number(data.amount) * 100)
                    : session?.amount || order?.total || 0;
                const currency = data.currency || session?.currency || order?.currency || "EGP";

                if (eventType === "refund" || eventType === "partial_refund") {
                    // Refund flow
                    const pendingRefund = data.transactionId
                        ? await findTransactionByProviderReference(data.transactionId, trx)
                        : null;

                    if (pendingRefund) {
                        await updateTransactionStatus(
                            pendingRefund.id,
                            TransactionStatus.SUCCEEDED,
                            trx
                        );
                        if (pendingRefund.refundedPaymentId) {
                            await updateTransactionStatus(
                                pendingRefund.refundedPaymentId,
                                TransactionStatus.SUCCEEDED,
                                trx,
                                { isRefunded: true }
                            );
                        }
                    }
                } else {
                    // Payment flow (pay / capture / authorize)
                    const isSuccess = data.status === "SUCCESS";

                    if (session) {
                        await updatePaymentSessionStatus(
                            session.id,
                            isSuccess ? PaymentSessionStatus.CAPTURED : PaymentSessionStatus.FAILED,
                            data,
                            trx
                        );
                    }

                    if (isSuccess) {
                        // 1. Record successful charge in transactions ledger
                        const charge = await createTransaction(
                            {
                                region: targetRegion!,
                                orderId: order?.id,
                                orderCreatedAt: order?.createdAt,
                                transactionType: TransactionType.CHARGE,
                                method: TransactionMethod.ONLINE,
                                providerId: provider.id,
                                providerReferenceId: data.transactionId || providerSessionId,
                                status: TransactionStatus.SUCCEEDED,
                                amount: amountMinor,
                                currency,
                                srcAccId: order?.customerId,
                                dstAccId: order?.restaurantOwnerId,
                                isRefunded: false,
                                idempotencyKey: providerEventId,
                            },
                            trx
                        );

                        // 2. Advance order from pending_payment to placed
                        if (order && order.status === OrderStatus.PENDING_PAYMENT) {
                            await updateOrderStatus(
                                order.publicId,
                                OrderStatus.PLACED,
                                { updatedAt: new Date() },
                                trx
                            );

                            // Invalidate branch cache
                            const keys = await redisClient.keys(`restaurant:orders:${order.branchId}:*`).catch(() => []);
                            if (keys.length > 0) {
                                await redisClient.del(...keys).catch(() => {});
                            }

                            // 3. Emit real-time WebSocket events
                            this.emitWs(`branch:${order.branchId}`, "order.created", {
                                publicId: order.publicId,
                                status: OrderStatus.PLACED,
                                total: order.total,
                                currency: order.currency,
                                branchId: order.branchId,
                                createdAt: order.createdAt?.toISOString(),
                            });

                            this.emitWs(`customer:${order.customerId}`, "order.status_changed", {
                                publicId: order.publicId,
                                status: OrderStatus.PLACED,
                                transactionId: charge.id,
                                updatedAt: new Date().toISOString(),
                            });
                        }
                    } else {
                        // Record failed attempt
                        await createTransaction(
                            {
                                region: targetRegion!,
                                orderId: order?.id,
                                orderCreatedAt: order?.createdAt,
                                transactionType: TransactionType.CHARGE,
                                method: TransactionMethod.ONLINE,
                                providerId: provider.id,
                                providerReferenceId: data.transactionId || providerSessionId,
                                status: TransactionStatus.FAILED,
                                amount: amountMinor,
                                currency,
                                srcAccId: order?.customerId,
                                dstAccId: order?.restaurantOwnerId,
                                idempotencyKey: providerEventId,
                            },
                            trx
                        );

                        if (order) {
                            this.emitWs(`customer:${order.customerId}`, "order.payment_failed", {
                                publicId: order.publicId,
                                reason: data.transactionResponseCode || "Payment failed",
                            });
                        }
                    }
                }

                await markWebhookEventProcessed(provider.id, providerEventId, trx);
            });
        } catch (err: any) {
            await markWebhookEventProcessed(provider.id, providerEventId, conn, err?.message || String(err));
            throw err;
        }

        return { acknowledged: true };
    }
}
