import { OrderStatus, PaymentMethod } from "../enums";

export interface OrderEntityProps {
    id?: number;
    region: string;
    publicId: string;
    countryCode: string;
    restaurantId: number;
    branchId: number;
    customerId: number;
    customerAddressId: number;
    deliveryLat: number;
    deliveryLng: number;
    deliveryAddressTextSnapshot: string;
    status: OrderStatus;
    subtotal: number;
    deliveryFee: number;
    serviceFee: number;
    total: number;
    commission?: number;
    currency: string;
    paymentMethod: PaymentMethod;
    deliveryAgentId?: number | null;
    createdAt?: Date;
    updatedAt?: Date;
    acceptedAt?: Date | null;
    rejectedAt?: Date | null;
    readyAt?: Date | null;
    assignedAt?: Date | null;
    pickedAt?: Date | null;
    deliveredAt?: Date | null;
    cancelledAt?: Date | null;
}

export class OrderEntity {
    id?: number;
    region: string;
    publicId: string;
    countryCode: string;
    restaurantId: number;
    branchId: number;
    customerId: number;
    customerAddressId: number;
    deliveryLat: number;
    deliveryLng: number;
    deliveryAddressTextSnapshot: string;
    status: OrderStatus;
    subtotal: number;
    deliveryFee: number;
    serviceFee: number;
    total: number;
    commission: number;
    currency: string;
    paymentMethod: PaymentMethod;
    deliveryAgentId?: number | null;
    createdAt?: Date;
    updatedAt?: Date;
    acceptedAt?: Date | null;
    rejectedAt?: Date | null;
    readyAt?: Date | null;
    assignedAt?: Date | null;
    pickedAt?: Date | null;
    deliveredAt?: Date | null;
    cancelledAt?: Date | null;

    constructor(props: OrderEntityProps) {
        this.id = props.id;
        this.region = props.region;
        this.publicId = props.publicId;
        this.countryCode = props.countryCode;
        this.restaurantId = props.restaurantId;
        this.branchId = props.branchId;
        this.customerId = props.customerId;
        this.customerAddressId = props.customerAddressId;
        this.deliveryLat = props.deliveryLat;
        this.deliveryLng = props.deliveryLng;
        this.deliveryAddressTextSnapshot = props.deliveryAddressTextSnapshot;
        this.status = props.status;
        this.subtotal = props.subtotal;
        this.deliveryFee = props.deliveryFee;
        this.serviceFee = props.serviceFee;
        this.total = props.total;
        this.commission = props.commission ?? 0;
        this.currency = props.currency;
        this.paymentMethod = props.paymentMethod;
        this.deliveryAgentId = props.deliveryAgentId ?? null;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
        this.acceptedAt = props.acceptedAt ?? null;
        this.rejectedAt = props.rejectedAt ?? null;
        this.readyAt = props.readyAt ?? null;
        this.assignedAt = props.assignedAt ?? null;
        this.pickedAt = props.pickedAt ?? null;
        this.deliveredAt = props.deliveredAt ?? null;
        this.cancelledAt = props.cancelledAt ?? null;
    }
}
