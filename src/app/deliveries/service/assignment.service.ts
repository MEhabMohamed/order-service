import { inject, injectable } from "tsyringe";
import { TOKENS } from "../../../lib/di/tokens";
import { Logger } from "../../../lib/logger/logger";
import { db } from "../../../lib/knex/knex";
import { findOrderByPublicId, setDeliveryAgent, unassignDeliveryAgent } from "../../orders/repository/order.repo";
import { OrderStatus } from "../../orders/enums";
import { OrderAlreadyHasActiveDeliveryError, OrderNotReadyError, NoEligibleAgentsError } from "../errors";
import { PresenceService } from "../../agents/service/presence.service";
import { agentClient } from "../../../lib/core-client/agent.client";
import { DeliveryResponseDTO } from "../dto/delivery-response.dto";
import { DeliveryStatus } from "../enums";
import { container } from "../../../lib/di/container";

@injectable()
export class AssignmentService {
    constructor(
        @inject(TOKENS.PresenceService) private readonly presenceService: PresenceService,
        @inject(TOKENS.Logger) private readonly logger: Logger
    ) {}

    async tryAssign(orderPublicId: string, region: string): Promise<DeliveryResponseDTO | null> {
        const conn = db(region);
        const order = await findOrderByPublicId(orderPublicId, conn);
        if (!order) {
            return null;
        }

        if (order.status !== OrderStatus.READY) {
            return null;
        }

        if (order.deliveryAgentId) {
            return null;
        }

        const candidates = await this.presenceService.findNearbyEligibleAgents(
            region,
            order.branchLat,
            order.branchLng
        );

        if (candidates.length === 0) {
            this.logger.warn(`No eligible agents found for order ${orderPublicId} in region ${region}`);
            this.emitWs("admin", "assignment.unassigned_alert", {
                orderId: order.publicId,
                branchId: order.branchId,
                region,
                reason: "no_eligible_agents",
                ts: new Date().toISOString(),
            });
            return null;
        }

        const chosen = candidates[0];
        await setDeliveryAgent(order.publicId, chosen.agentId, conn);
        await this.presenceService.markAgentBusy(region, chosen.agentId);

        const agent = await agentClient.getAgent(chosen.agentId);
        const now = new Date();

        this.emitWs(`agent:${chosen.agentId}`, "task.assigned", {
            orderPublicId: order.publicId,
            branchLat: order.branchLat,
            branchLng: order.branchLng,
            deliveryLat: order.deliveryLat,
            deliveryLng: order.deliveryLng,
            total: order.total,
            currency: order.currency,
            assignedAt: now.toISOString(),
        });

        this.emitWs(`customer:${order.customerId}`, "delivery.status_changed", {
            orderId: order.publicId,
            status: DeliveryStatus.ASSIGNED,
            agent: { id: agent.id, name: agent.name, phone: agent.phone },
            ts: now.toISOString(),
        });

        this.emitWs(`branch:${order.branchId}`, "delivery.status_changed", {
            orderId: order.publicId,
            status: DeliveryStatus.ASSIGNED,
            agentId: chosen.agentId,
            ts: now.toISOString(),
        });

        return {
            id: order.id!,
            orderPublicId: order.publicId,
            agent: {
                id: agent.id,
                name: agent.name,
                phone: agent.phone,
            },
            status: DeliveryStatus.ASSIGNED,
            pickup: { lat: order.branchLat, lng: order.branchLng },
            dropoff: { lat: order.deliveryLat, lng: order.deliveryLng },
            distanceMeters: chosen.distanceMeters,
            assignedAt: now.toISOString(),
        };
    }

    async assignManual(orderPublicId: string, agentId: number, region: string): Promise<DeliveryResponseDTO> {
        const conn = db(region);
        const order = await findOrderByPublicId(orderPublicId, conn);
        if (!order) {
            throw new OrderNotReadyError();
        }

        if (order.status !== OrderStatus.READY) {
            throw new OrderNotReadyError();
        }

        if (order.deliveryAgentId) {
            throw new OrderAlreadyHasActiveDeliveryError();
        }

        await setDeliveryAgent(order.publicId, agentId, conn);
        await this.presenceService.markAgentBusy(region, agentId);

        const agent = await agentClient.getAgent(agentId);
        const now = new Date();

        this.emitWs(`agent:${agentId}`, "task.assigned", {
            orderPublicId: order.publicId,
            branchLat: order.branchLat,
            branchLng: order.branchLng,
            deliveryLat: order.deliveryLat,
            deliveryLng: order.deliveryLng,
            total: order.total,
            currency: order.currency,
            assignedAt: now.toISOString(),
        });

        this.emitWs(`customer:${order.customerId}`, "delivery.status_changed", {
            orderId: order.publicId,
            status: DeliveryStatus.ASSIGNED,
            agent: { id: agent.id, name: agent.name, phone: agent.phone },
            ts: now.toISOString(),
        });

        this.emitWs(`branch:${order.branchId}`, "delivery.status_changed", {
            orderId: order.publicId,
            status: DeliveryStatus.ASSIGNED,
            agentId,
            ts: now.toISOString(),
        });

        return {
            id: order.id!,
            orderPublicId: order.publicId,
            agent: {
                id: agent.id,
                name: agent.name,
                phone: agent.phone,
            },
            status: DeliveryStatus.ASSIGNED,
            pickup: { lat: order.branchLat, lng: order.branchLng },
            dropoff: { lat: order.deliveryLat, lng: order.deliveryLng },
            distanceMeters: null,
            assignedAt: now.toISOString(),
        };
    }

    async reassign(orderPublicId: string, region: string): Promise<DeliveryResponseDTO> {
        const conn = db(region);
        const order = await findOrderByPublicId(orderPublicId, conn);
        if (!order) {
            throw new OrderNotReadyError();
        }

        if (order.deliveryAgentId) {
            await this.presenceService.releaseAgentBusy(region, order.deliveryAgentId);
            await unassignDeliveryAgent(order.publicId, conn);
        }

        const assigned = await this.tryAssign(order.publicId, region);
        if (!assigned) {
            throw new NoEligibleAgentsError();
        }

        return assigned;
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
