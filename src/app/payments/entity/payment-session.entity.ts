import { PaymentSessionStatus } from "../enums";

export class PaymentSessionEntity {
    id!: number;
    region!: string;
    orderId!: number;
    orderCreatedAt!: Date;
    providerId!: number;
    providerSessionId!: string;
    redirectUrl!: string;
    amount!: number;
    currency!: string;
    status!: PaymentSessionStatus;
    rawInitPayload!: Record<string, any>;
    rawLastPayload?: Record<string, any>;
    createdAt!: Date;
    updatedAt!: Date;

    static toEntity(row: any): PaymentSessionEntity {
        const entity = new PaymentSessionEntity();
        entity.id = Number(row.id);
        entity.region = row.region;
        entity.orderId = Number(row.order_id);
        entity.orderCreatedAt = new Date(row.order_created_at);
        entity.providerId = Number(row.provider_id);
        entity.providerSessionId = row.provider_session_id;
        entity.redirectUrl = row.redirect_url;
        entity.amount = Number(row.amount);
        entity.currency = row.currency;
        entity.status = row.status as PaymentSessionStatus;
        entity.rawInitPayload = typeof row.raw_init_payload === "string" ? JSON.parse(row.raw_init_payload) : row.raw_init_payload;
        entity.rawLastPayload = row.raw_last_payload ? (typeof row.raw_last_payload === "string" ? JSON.parse(row.raw_last_payload) : row.raw_last_payload) : undefined;
        entity.createdAt = new Date(row.created_at);
        entity.updatedAt = new Date(row.updated_at);
        return entity;
    }
}
