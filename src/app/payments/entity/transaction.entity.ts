import { TransactionMethod, TransactionStatus, TransactionType } from "../enums";

export class TransactionEntity {
    id!: number;
    region!: string;
    orderId?: number;
    orderCreatedAt?: Date;
    transactionType!: TransactionType;
    method!: TransactionMethod;
    providerId?: number;
    providerReferenceId?: string;
    status!: TransactionStatus;
    amount!: number;
    currency!: string;
    srcAccId?: number | null;
    dstAccId?: number | null;
    isRefunded!: boolean;
    refundedPaymentId?: number | null;
    idempotencyKey?: string | null;
    createdAt!: Date;
    updatedAt!: Date;

    static toEntity(row: any): TransactionEntity {
        const entity = new TransactionEntity();
        entity.id = Number(row.id);
        entity.region = row.region;
        entity.orderId = row.order_id ? Number(row.order_id) : undefined;
        entity.orderCreatedAt = row.order_created_at ? new Date(row.order_created_at) : undefined;
        entity.transactionType = row.transaction_type as TransactionType;
        entity.method = row.method as TransactionMethod;
        entity.providerId = row.provider_id ? Number(row.provider_id) : undefined;
        entity.providerReferenceId = row.provider_reference_id || undefined;
        entity.status = row.status as TransactionStatus;
        entity.amount = Number(row.amount);
        entity.currency = row.currency;
        entity.srcAccId = row.src_acc_id !== null && row.src_acc_id !== undefined ? Number(row.src_acc_id) : null;
        entity.dstAccId = row.dst_acc_id !== null && row.dst_acc_id !== undefined ? Number(row.dst_acc_id) : null;
        entity.isRefunded = Boolean(row.is_refunded);
        entity.refundedPaymentId = row.refunded_payment_id ? Number(row.refunded_payment_id) : null;
        entity.idempotencyKey = row.idempotency_key || null;
        entity.createdAt = new Date(row.created_at);
        entity.updatedAt = new Date(row.updated_at);
        return entity;
    }
}
