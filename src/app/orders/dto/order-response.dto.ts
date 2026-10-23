import { OrderStatus, PaymentMethod } from "../enums";

export interface OrderItemResponseDTO {
    productId: number;
    name: string;
    imageUrl?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
}

export interface OrderResponseDTO {
    publicId: string;
    status: OrderStatus;
    paymentMethod: PaymentMethod;
    branch: { id: number; name: string };
    restaurant: { id: number; name: string };
    customerAddress: { lat: number; lng: number; addressText: string };
    subtotal: number;
    deliveryFee: number;
    serviceFee: number;
    total: number;
    currency: string;
    items: OrderItemResponseDTO[];
    createdAt: string;
    payment?: { sessionId: string; redirectUrl: string };
}

export interface OrderSummaryResponseDTO {
    publicId: string;
    status: OrderStatus;
    total: number;
    currency: string;
    itemsCount: number;
    restaurant: { id: number; name: string };
    branchId: number;
    createdAt: string;
}

export interface OrderDetailResponseDTO extends OrderResponseDTO {
    delivery?: {
        id: number;
        status: string;
        agent?: { id: number; name: string; phone?: string; lastLat?: number; lastLng?: number; lastSeenAt?: string };
        assignedAt: string;
        acceptedAt?: string;
        pickedAt?: string;
        deliveredAt?: string;
    };
    paymentSummary?: {
        method: PaymentMethod;
        status: "pending" | "authorized" | "captured" | "failed" | "refunded";
        amount: number;
        currency: string;
        refundedAmount: number;
    };
    history: Array<{ status: OrderStatus; ts: string }>;
}

export interface OrderStatusResponseDTO {
    publicId: string;
    status: OrderStatus;
    updatedAt: string;
}
