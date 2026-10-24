import { inject, injectable } from "tsyringe";
import { TOKENS } from "../../../lib/di/tokens";
import { Logger } from "../../../lib/logger/logger";
import { db } from "../../../lib/knex/knex";
import { OrderStatus } from "../../orders/enums";
import { findOrdersByAgent } from "../../orders/repository/order.repo";
import { branchClient } from "../../../lib/core-client/branch.client";
import { DeliveryTaskResponseDTO } from "../dto/agent-response.dto";

@injectable()
export class AgentService {
    constructor(
        @inject(TOKENS.Logger) private readonly logger: Logger
    ) {}

    async listTasks(
        agentId: number,
        region: string,
        query: { status?: OrderStatus; cursor?: string; limit?: number }
    ): Promise<{ tasks: DeliveryTaskResponseDTO[]; nextCursor: string | null; hasMore: boolean }> {
        const conn = db(region);
        const { orders, nextCursor, hasMore } = await findOrdersByAgent(agentId, query, conn);

        const tasks: DeliveryTaskResponseDTO[] = await Promise.all(
            orders.map(async (order) => {
                const branch = await branchClient.getBranch(order.branchId).catch(() => null);

                return {
                    deliveryId: order.id!,
                    orderPublicId: order.publicId,
                    status: order.status,
                    pickup: {
                        branchName: branch ? branch.name : `Branch #${order.branchId}`,
                        lat: order.branchLat,
                        lng: order.branchLng,
                        addressText: branch ? branch.addressText : "",
                    },
                    dropoff: {
                        lat: order.deliveryLat,
                        lng: order.deliveryLng,
                        addressText: order.deliveryAddressTextSnapshot,
                    },
                    itemsCount: 0,
                    total: order.total,
                    currency: order.currency,
                    paymentMethod: order.paymentMethod,
                    earningEstimate: order.deliveryFee,
                    assignedAt: order.assignedAt ? order.assignedAt.toISOString() : order.createdAt!.toISOString(),
                };
            })
        );

        return { tasks, nextCursor, hasMore };
    }
}
