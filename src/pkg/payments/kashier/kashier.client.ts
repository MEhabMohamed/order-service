import { env } from "../../../lib/config/env";
import { AppError } from "../../../lib/error/AppError";
import { retry } from "../../utils/retry";
import { toMs } from "../../utils/time";
import {
    CreateSessionParams,
    CreateSessionResult,
    IPaymentProvider,
    RefundParams,
    RefundResult,
} from "../payment.interface";
import { verifyWebhookSignature } from "./kashier.signature";
import {
    KashierCreateSessionRequestBody,
    KashierCreateSessionResponse,
} from "./kashier.types";

export class KashierClient implements IPaymentProvider {
    private readonly baseUrl: string;
    private readonly merchantId: string;
    private readonly apiKey: string;
    private readonly secretKey: string;
    private readonly returnUrl: string;
    private readonly sessionTimeoutMin: number;

    constructor() {
        this.baseUrl = env.kashier.baseUrl.replace(/\/+$/, "");
        this.merchantId = env.kashier.merchantId;
        this.apiKey = env.kashier.apiKey;
        this.secretKey = env.kashier.secretKey;
        this.returnUrl = env.kashier.returnUrl;
        this.sessionTimeoutMin = env.kashier.sessionTimeoutMin;
    }

    async createSession(params: CreateSessionParams): Promise<CreateSessionResult> {
        const url = `${this.baseUrl}/v3/payment/sessions`;
        const expireDate = new Date(Date.now() + toMs.minute(this.sessionTimeoutMin));
        const expireAt = expireDate.toISOString();

        const amountDecimal = (params.amount / 100).toFixed(2);

        const body: KashierCreateSessionRequestBody = {
            amount: amountDecimal,
            currency: params.currency,
            order: params.orderPublicId,
            merchantId: this.merchantId,
            merchantRedirect: params.merchantRedirectUrl || this.returnUrl,
            allowedMethods: params.allowedMethods || "card,wallet",
            defaultMethod: params.defaultMethod || "card",
            display: "en",
            type: "one-time",
            expireAt,
            maxFailureAttempts: 3,
            description: params.description || `QuickBite Order ${params.orderPublicId}`,
        };

        if (params.customerEmail || params.customerReference) {
            body.customer = {
                email: params.customerEmail,
                reference: params.customerReference,
            };
        }

        if (params.serverWebhookUrl) {
            body.serverWebhook = params.serverWebhookUrl;
        }

        const res = await retry(
            async () => {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: this.secretKey,
                        apiKey: this.apiKey,
                    },
                    body: JSON.stringify(body),
                });

                if (response.status >= 500) {
                    throw new AppError(`Kashier server error: ${response.statusText}`, 503);
                }

                return response;
            },
            {
                attempts: 3,
                initialDelayMs: 200,
                maxDelayMs: 1000,
            }
        );

        const data = (await res.json()) as KashierCreateSessionResponse;

        if (!res.ok) {
            const errorMsg = (data as any)?.message || (data as any)?.error || res.statusText;
            throw new AppError(`Kashier session creation failed: ${errorMsg}`, 502);
        }

        if (!data._id || !data.sessionUrl) {
            throw new AppError("Kashier returned incomplete session response", 502);
        }

        return {
            sessionId: data._id,
            sessionUrl: data.sessionUrl,
            rawResponse: data,
        };
    }

    async refund(params: RefundParams): Promise<RefundResult> {
        const url = `${this.baseUrl}/v3/payments/refund`;
        const amountDecimal = (params.amount / 100).toFixed(2);

        const body = {
            transactionId: params.transactionId,
            amount: amountDecimal,
            currency: params.currency,
            reason: params.reason || "Customer requested refund",
        };

        const res = await retry(
            async () => {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: this.secretKey,
                        apiKey: this.apiKey,
                    },
                    body: JSON.stringify(body),
                });

                if (response.status >= 500) {
                    throw new AppError(`Kashier refund service error: ${response.statusText}`, 503);
                }

                return response;
            },
            {
                attempts: 3,
                initialDelayMs: 200,
                maxDelayMs: 1000,
            }
        );

        const data = await res.json();

        if (!res.ok) {
            const errorMsg = (data as any)?.message || (data as any)?.error || res.statusText;
            throw new AppError(`Kashier refund failed: ${errorMsg}`, 502);
        }

        return {
            refundId: data?.refundId || data?._id || `ref_${Date.now()}`,
            status: data?.status || "pending",
            rawResponse: data,
        };
    }

    verifyWebhookSignature(signature: string, payload: any): boolean {
        const webhookData = payload?.data;
        if (!webhookData) {
            return false;
        }
        return verifyWebhookSignature(signature, webhookData, this.apiKey);
    }
}

export const kashierClient = new KashierClient();
