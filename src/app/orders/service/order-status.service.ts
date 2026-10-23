import { OrderStatus } from "../enums";
import { CancellationWindowExpiredError, InvalidStatusTransitionError, UnauthorizedOrderAccessError } from "../errors";

export interface ActorContext {
    userId: number;
    systemRole: string;
    isCustomer: boolean;
    isRestaurantMember: boolean;
    isAdmin: boolean;
}

export class OrderStatusService {
    assertTransition(
        from: OrderStatus,
        to: OrderStatus,
        actor: ActorContext,
        createdAt?: Date,
        acceptedAt?: Date | null
    ): void {
        if (from === to) {
            throw new InvalidStatusTransitionError(from, to);
        }

        // Customer cancellation check
        if (to === OrderStatus.CANCELLED && actor.isCustomer && !actor.isRestaurantMember && !actor.isAdmin) {
            if (from !== OrderStatus.PENDING_PAYMENT && from !== OrderStatus.PLACED) {
                throw new InvalidStatusTransitionError(from, to);
            }
            if (acceptedAt) {
                throw new CancellationWindowExpiredError();
            }
            if (createdAt) {
                const elapsedSec = (Date.now() - createdAt.getTime()) / 1000;
                if (elapsedSec > 60) {
                    throw new CancellationWindowExpiredError();
                }
            }
            return;
        }

        // Restaurant-side transitions
        if (actor.isRestaurantMember || actor.isAdmin) {
            switch (from) {
                case OrderStatus.PLACED:
                    if ([OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.CANCELLED].includes(to)) {
                        return;
                    }
                    break;
                case OrderStatus.ACCEPTED:
                    if ([OrderStatus.PREPARING, OrderStatus.CANCELLED].includes(to)) {
                        return;
                    }
                    break;
                case OrderStatus.PREPARING:
                    if ([OrderStatus.READY, OrderStatus.CANCELLED].includes(to)) {
                        return;
                    }
                    break;
                case OrderStatus.READY:
                    if ([OrderStatus.ASSIGNED, OrderStatus.CANCELLED].includes(to)) {
                        return;
                    }
                    break;
                case OrderStatus.ASSIGNED:
                    if (actor.isAdmin && to === OrderStatus.CANCELLED) {
                        return;
                    }
                    break;
            }
        }

        // Delivery agent transitions
        if (actor.systemRole === "delivery_agent" || actor.isAdmin) {
            if (from === OrderStatus.ASSIGNED && to === OrderStatus.PICKED) {
                return;
            }
            if (from === OrderStatus.PICKED && to === OrderStatus.DELIVERED) {
                return;
            }
        }

        // System transitions (admin acts on behalf of system)
        if (actor.isAdmin) {
            if (from === OrderStatus.READY && to === OrderStatus.ASSIGNED) {
                return;
            }
            if (to === OrderStatus.CANCELLED) {
                return;
            }
        }

        throw new InvalidStatusTransitionError(from, to);
    }
}

export const orderStatusService = new OrderStatusService();
