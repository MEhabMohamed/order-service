import { PaymentSessionStatus, TransactionMethod, TransactionStatus, TransactionType } from "./enums";

export interface CreatePaymentSessionInput {
    region: string;
    orderId: number;
    orderCreatedAt: Date;
    providerId: number;
    providerSessionId: string;
    redirectUrl: string;
    amount: number;
    currency: string;
    status: PaymentSessionStatus;
    rawInitPayload: Record<string, any>;
}

export interface CreateTransactionInput {
    region: string;
    orderId?: number;
    orderCreatedAt?: Date;
    transactionType: TransactionType;
    method: TransactionMethod;
    providerId?: number;
    providerReferenceId?: string;
    status: TransactionStatus;
    amount: number;
    currency: string;
    srcAccId?: number | null;
    dstAccId?: number | null;
    isRefunded?: boolean;
    refundedPaymentId?: number | null;
    idempotencyKey?: string | null;
}

export interface RecordWebhookEventInput {
    region: string;
    providerId: number;
    providerEventId: string;
    signature: string;
    payload: Record<string, any>;
}
