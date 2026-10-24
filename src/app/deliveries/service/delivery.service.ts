import { inject, injectable } from "tsyringe";
import { TOKENS } from "../../../lib/di/tokens";
import { Logger } from "../../../lib/logger/logger";
import { db } from "../../../lib/knex/knex";
import { redisClient } from "../../../lib/cache/init";
import { findOrderByPublicId, findOrderById, completeOrderSettlement } from "../../orders/repository/order.repo";
import { OrderStatus, PaymentMethod } from "../../orders/enums";
import { DeliveryStatus } from "../enums";
import { InvalidDeliveryStatusTransitionError, UnauthorizedDeliveryAccessError } from "../errors";
import { OrderNotFoundError } from "../../orders/errors";
import { PresenceService } from "../../agents/service/presence.service";
import { AssignmentService } from "./assignment.service";
import { DeliveryStatusResponseDTO } from "../dto/delivery-response.dto";
import { upsertBalance, findBalanceForUpdate } from "../repository/restaurant-balance.repo";
import { createEarning } from "../../agents/repository/agent-earning.repo";
import { container } from "../../../lib/di/container";

@injectable()
export class DeliveryService {
    constructor(
        @inject(TOKENS.PresenceService) private readonly presenceService: PresenceService,
        @inject(TOKENS.AssignmentService) private readonly assignmentService: AssignmentService,
        @inject(TOKENS.Logger) private readonly logger: Logger
    ) {}

    async updateStatus(
        orderPublicIdOrId: string,
        newStatus: DeliveryStatus,
        actor: { userId: number; role?: string },
        region: string,
        reason?: string
    ): Promise<DeliveryStatusResponseDTO> {
        const conn = db(region);

        // Find order by public_id or numeric id
        let order = await findOrderByPublicId(orderPublicIdOrId, conn);
        if (!order && !isNaN(Number(orderPublicIdOrId))) {
            order = await findOrderById(Number(orderPublicIdOrId), conn);
        }

        if (!order) {
            throw new OrderNotFoundError();
        }

        const isAssignedAgent = Number(order.deliveryAgentId) === Number(actor.userId);
        const isAdmin = actor.role === "system_admin";

        if (!isAssignedAgent && !isAdmin) {
            throw new UnauthorizedDeliveryAccessError();
        }

        const now = new Date();

        switch (newStatus) {
            case DeliveryStatus.ACCEPTED: {
                if (order.status !== OrderStatus.ASSIGNED) {
                    throw new InvalidDeliveryStatusTransitionError(order.status, newStatus);
                }

                await conn("orders")
                    .where({ id: order.id })
                    .update({
                        accepted_at: now,
                        updated_at: now,
                    });

                this.emitWs(`customer:${order.customerId}`, "delivery.status_changed", {
                    orderId: order.publicId,
                    status: DeliveryStatus.ACCEPTED,
                    agentId: order.deliveryAgentId,
                    ts: now.toISOString(),
                });
                this.emitWs(`branch:${order.branchId}`, "delivery.status_changed", {
                    orderId: order.publicId,
                    status: DeliveryStatus.ACCEPTED,
                    agentId: order.deliveryAgentId,
                    ts: now.toISOString(),
                });

                return {
                    id: order.id!,
                    status: DeliveryStatus.ACCEPTED,
                    updatedAt: now.toISOString(),
                };
            }

            case DeliveryStatus.REJECTED: {
                if (order.status !== OrderStatus.ASSIGNED) {
                    throw new InvalidDeliveryStatusTransitionError(order.status, newStatus);
                }

                if (order.deliveryAgentId) {
                    await this.presenceService.releaseAgentBusy(region, order.deliveryAgentId);
                }

                await conn("orders")
                    .where({ id: order.id })
                    .update({
                        delivery_agent_id: null,
                        status: OrderStatus.READY,
                        rejected_at: now,
                        updated_at: now,
                    });

                this.logger.info(`Agent ${order.deliveryAgentId} rejected order ${order.publicId}. Triggering reassignment.`);
                // Trigger reassignment in background
                this.assignmentService.reassign(order.publicId, region).catch((err) => {
                    this.logger.warn(`Auto-reassignment after rejection failed: ${err.message}`);
                });

                return {
                    id: order.id!,
                    status: DeliveryStatus.REJECTED,
                    updatedAt: now.toISOString(),
                };
            }

            case DeliveryStatus.PICKED: {
                if (order.status !== OrderStatus.ASSIGNED) {
                    throw new InvalidDeliveryStatusTransitionError(order.status, newStatus);
                }

                await conn("orders")
                    .where({ id: order.id })
                    .update({
                        status: OrderStatus.PICKED,
                        picked_at: now,
                        updated_at: now,
                    });

                this.emitWs(`customer:${order.customerId}`, "delivery.status_changed", {
                    orderId: order.publicId,
                    status: DeliveryStatus.PICKED,
                    agentId: order.deliveryAgentId,
                    ts: now.toISOString(),
                });
                this.emitWs(`branch:${order.branchId}`, "delivery.status_changed", {
                    orderId: order.publicId,
                    status: DeliveryStatus.PICKED,
                    agentId: order.deliveryAgentId,
                    ts: now.toISOString(),
                });

                return {
                    id: order.id!,
                    status: DeliveryStatus.PICKED,
                    updatedAt: now.toISOString(),
                };
            }

            case DeliveryStatus.DELIVERED: {
                if (order.status !== OrderStatus.PICKED) {
                    throw new InvalidDeliveryStatusTransitionError(order.status, newStatus);
                }

                // Atomic settlement transaction
                const trx = await conn.transaction();
                try {
                    // 1. Lock restaurant balance
                    await findBalanceForUpdate(order.restaurantId, order.currency, trx);

                    // 2. Platform commission (default 10% if not set)
                    const commissionRate = 0.10;
                    const commission = Math.floor(order.subtotal * commissionRate);

                    // 3. For COD: flip pending cod_collection transaction to succeeded
                    if (order.paymentMethod === PaymentMethod.COD) {
                        await trx("transactions")
                            .where({
                                order_id: order.id,
                                transaction_type: "cod_collection",
                            })
                            .update({
                                status: "succeeded",
                                updated_at: now,
                            });
                    }

                    // 4. Record platform commission in transactions
                    await trx("transactions").insert({
                        region,
                        order_id: order.id,
                        order_created_at: order.createdAt,
                        transaction_type: "commission",
                        method: "system",
                        status: "succeeded",
                        amount: commission,
                        currency: order.currency,
                        src_acc_id: order.restaurantOwnerId,
                        dst_acc_id: null, // system platform
                        created_at: now,
                        updated_at: now,
                    });

                    // 5. Increment restaurant balance (subtotal - commission)
                    const restaurantNet = order.subtotal - commission;
                    await upsertBalance(order.restaurantId, region, order.currency, restaurantNet, trx);

                    // 6. Record agent earnings (delivery fee)
                    const agentEarning = order.deliveryFee;
                    await createEarning(
                        {
                            region,
                            agentId: order.deliveryAgentId!,
                            orderId: order.id!,
                            orderCreatedAt: order.createdAt!,
                            amount: agentEarning,
                            currency: order.currency,
                            earnedAt: now,
                        },
                        trx
                    );

                    // 7. Update order to DELIVERED with commission
                    await completeOrderSettlement(order.publicId, commission, trx);

                    await trx.commit();
                } catch (err) {
                    await trx.rollback();
                    this.logger.error("Delivered settlement transaction failed", { error: (err as Error).message });
                    throw err;
                }

                // 8. Release agent from busy set
                if (order.deliveryAgentId) {
                    await this.presenceService.releaseAgentBusy(region, order.deliveryAgentId);
                }

                // Invalidate branch order cache
                const keys = await redisClient.keys(`restaurant:orders:${order.branchId}:*`).catch(() => []);
                if (keys.length > 0) {
                    await redisClient.del(...keys).catch(() => {});
                }

                // 9. Emit WebSockets
                this.emitWs(`customer:${order.customerId}`, "delivery.status_changed", {
                    orderId: order.publicId,
                    status: DeliveryStatus.DELIVERED,
                    agentId: order.deliveryAgentId,
                    ts: now.toISOString(),
                });
                this.emitWs(`branch:${order.branchId}`, "delivery.status_changed", {
                    orderId: order.publicId,
                    status: DeliveryStatus.DELIVERED,
                    agentId: order.deliveryAgentId,
                    ts: now.toISOString(),
                });
                this.emitWs(`agent:${order.deliveryAgentId}`, "task.completed", {
                    orderId: order.publicId,
                    earned: order.deliveryFee,
                    currency: order.currency,
                    ts: now.toISOString(),
                });

                return {
                    id: order.id!,
                    status: DeliveryStatus.DELIVERED,
                    updatedAt: now.toISOString(),
                };
            }

            default:
                throw new InvalidDeliveryStatusTransitionError(order.status, newStatus);
        }
    }

    private emitWs(room: string, event: string, payload: any): void {
        try {
            const io = container.resolve<any>(TOKENS.WsServer);
            if (io && typeof io.to === "function") {
                io.to(room).emit(event, payload);
            }
        } catch {
            // WS emission non-blocking
        }
    }
}
