export class PaymentWebhookEventEntity {
    id!: number;
    region!: string;
    providerId!: number;
    providerEventId!: string;
    signature!: string;
    payload!: Record<string, any>;
    receivedAt!: Date;
    processedAt?: Date;
    processError?: string;

    static toEntity(row: any): PaymentWebhookEventEntity {
        const entity = new PaymentWebhookEventEntity();
        entity.id = Number(row.id);
        entity.region = row.region;
        entity.providerId = Number(row.provider_id);
        entity.providerEventId = row.provider_event_id;
        entity.signature = row.signature;
        entity.payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
        entity.receivedAt = new Date(row.received_at);
        entity.processedAt = row.processed_at ? new Date(row.processed_at) : undefined;
        entity.processError = row.process_error || undefined;
        return entity;
    }
}
