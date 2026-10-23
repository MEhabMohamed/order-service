export interface OrderItemEntityProps {
    id?: number;
    region: string;
    orderId: number;
    orderCreatedAt: Date;
    productId: number;
    quantity: number;
    unitPriceSnapshot: number;
    nameSnapshot: string;
    imageUrlSnapshot?: string | null;
    lineTotal: number;
    createdAt?: Date;
}

export class OrderItemEntity {
    id?: number;
    region: string;
    orderId: number;
    orderCreatedAt: Date;
    productId: number;
    quantity: number;
    unitPriceSnapshot: number;
    nameSnapshot: string;
    imageUrlSnapshot?: string | null;
    lineTotal: number;
    createdAt?: Date;

    constructor(props: OrderItemEntityProps) {
        this.id = props.id;
        this.region = props.region;
        this.orderId = props.orderId;
        this.orderCreatedAt = props.orderCreatedAt;
        this.productId = props.productId;
        this.quantity = props.quantity;
        this.unitPriceSnapshot = props.unitPriceSnapshot;
        this.nameSnapshot = props.nameSnapshot;
        this.imageUrlSnapshot = props.imageUrlSnapshot ?? null;
        this.lineTotal = props.lineTotal;
        this.createdAt = props.createdAt;
    }
}
