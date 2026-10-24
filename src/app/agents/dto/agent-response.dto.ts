import { OrderStatus, PaymentMethod } from "../../orders/enums";

export class DeliveryTaskResponseDTO {
    deliveryId!: number | string;
    orderPublicId!: string;
    status!: OrderStatus;
    pickup!: {
        branchName: string;
        lat: number;
        lng: number;
        addressText: string;
    };
    dropoff!: {
        lat: number;
        lng: number;
        addressText: string;
    };
    itemsCount!: number;
    total!: number;
    currency!: string;
    paymentMethod!: PaymentMethod;
    earningEstimate?: number;
    assignedAt!: string;
}

export class AgentEarningsResponseDTO {
    range!: { from: string; to: string };
    totals!: { count: number; sum: number; currency: string };
    items!: Array<{
        orderPublicId: string;
        amount: number;
        currency: string;
        earnedAt: string;
    }>;
    nextCursor!: string | null;
}
