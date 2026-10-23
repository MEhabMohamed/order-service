export interface KashierCustomerInfo {
    email?: string;
    reference?: string;
}

export interface KashierCreateSessionRequestBody {
    amount: string;
    currency: string;
    order: string;
    merchantId: string;
    merchantRedirect: string;
    serverWebhook?: string;
    allowedMethods: string;
    defaultMethod?: string;
    display?: string;
    type?: string;
    expireAt: string;
    maxFailureAttempts?: number;
    description?: string;
    customer?: KashierCustomerInfo;
    saveCard?: string;
    interactionSource?: string;
    enable3DS?: boolean;
}

export interface KashierCreateSessionResponse {
    status: string;
    _id: string;
    sessionUrl: string;
    merchantId: string;
    expireAt: string;
    paymentParams?: Record<string, any>;
    [key: string]: any;
}

export interface KashierWebhookData {
    amount: number | string;
    currency: string;
    order?: string;
    orderReference?: string;
    merchantOrderId?: string;
    kashierOrderId?: string;
    transactionId?: string;
    method?: string;
    channel?: string;
    status: string; // 'SUCCESS' | 'FAILURE' | 'PENDING'
    transactionResponseCode?: string;
    signatureKeys: string[];
    [key: string]: any;
}

export interface KashierWebhookPayload {
    event: string; // 'pay', 'capture', 'refund', etc.
    data: KashierWebhookData;
}
