export interface CreateSessionParams {
    orderPublicId: string;
    amount: number; // minor units (e.g. 10000 = 100.00)
    currency: string;
    customerEmail?: string;
    customerReference?: string;
    merchantRedirectUrl?: string;
    serverWebhookUrl?: string;
    description?: string;
    allowedMethods?: string;
    defaultMethod?: string;
}

export interface CreateSessionResult {
    sessionId: string;
    sessionUrl: string;
    rawResponse: any;
}

export interface RefundParams {
    transactionId: string;
    amount: number; // minor units
    currency: string;
    reason?: string;
}

export interface RefundResult {
    refundId: string;
    status: string;
    rawResponse: any;
}

export interface IPaymentProvider {
    createSession(params: CreateSessionParams): Promise<CreateSessionResult>;
    refund(params: RefundParams): Promise<RefundResult>;
    verifyWebhookSignature(signature: string, payload: any): boolean;
}
