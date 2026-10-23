export class PaymentInitResponseDTO {
    sessionId!: number;
    providerSessionId!: string;
    redirectUrl!: string;
    expiresAt!: string;
    amount!: number;
    currency!: string;
}

export class PaymentResponseDTO {
    id!: number;
    orderPublicId?: string;
    type!: string;
    method!: string;
    provider?: string;
    providerReferenceId?: string;
    status!: string;
    amount!: number;
    currency!: string;
    isRefunded!: boolean;
    refundedPaymentId?: number;
    createdAt!: string;
    updatedAt!: string;
}

export class RefundResponseDTO {
    refundId!: number;
    status!: string;
    amount!: number;
    currency!: string;
}
