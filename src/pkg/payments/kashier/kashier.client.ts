import { retry } from "../../utils/retry";
import { IPaymentProvider } from "../payment.interface";
import { CreateSessionInput, CreateSessionResult, RefundInput, RefundResult, VerifyWebhookInput } from "../types";
import { KashierCreateSessionResponse } from "./types";
import { verifyWebhookSignature } from "./kashier.signature";
import { env } from "../../../lib/config/env";
import { toMs, toSec } from "../../utils/time";

export interface KashierClientConfig {
    baseUrl: string;
    fepBaseUrl?: string;
    merchantId: string;
    apiKey: string;          // also doubles as webhook HMAC secret
    secretKey: string;       // Authorization header value
    paymentType: string;     // "credit"
    serverWebhookUrl: string;
    /** Success redirect URL the customer lands on after a successful payment. */
    merchantRedirect?: string;
    /** Whether Kashier should also redirect on failure (vs leaving the customer on Kashier's failure page). */
    failureRedirectEnabled?: boolean;
    /** seconds before a session expires; passed as expireAt ISO timestamp */
    sessionTimeoutSec: number;
}

export class KashierClient implements IPaymentProvider {
    private readonly cfg: KashierClientConfig;

    constructor(cfg?: KashierClientConfig) {
        this.cfg = cfg ?? {
            baseUrl: env.kashier.baseUrl,
            fepBaseUrl: env.kashier.fepBaseUrl,
            merchantId: env.kashier.merchantId,
            apiKey: env.kashier.apiKey,
            secretKey: env.kashier.secretKey,
            paymentType: "credit",
            serverWebhookUrl: env.kashier.serverWebhookUrl,
            merchantRedirect: env.kashier.merchantRedirect,
            failureRedirectEnabled: env.kashier.failureRedirectEnabled,
            sessionTimeoutSec: toSec.minute(env.payments.sessionTimeoutMin),
        };
    }

    async createSession(input: CreateSessionInput & { orderPublicId?: string; defaultMethod?: string }): Promise<CreateSessionResult & { sessionId?: string; sessionUrl?: string }> {
        const expireAt = new Date(Date.now() + toMs.second(this.cfg.sessionTimeoutSec)).toISOString();
        const amount = typeof input.amount === "number"
            ? Number(input.amount).toFixed(2)
            : input.amount;

        const body: any = {
            merchantId: this.cfg.merchantId,
            paymentType: this.cfg.paymentType,
            amount,
            currency: input.currency,
            order: input.merchantOrderId ?? input.orderPublicId ?? "",
            type: "one-time",
            allowedMethods: input.allowedMethods ?? "card,wallet",
            enable3DS: true,
            serverWebhook: this.cfg.serverWebhookUrl,
            merchantRedirect: this.cfg.merchantRedirect,
            failureRedirect: this.cfg.failureRedirectEnabled ?? false,
            description: input.description,
            interactionSource: "ECOMMERCE",
            expireAt,
            customer: { reference: input.customerReference ?? "" },
        };
        if (input.defaultMethod) {
            body.defaultMethod = input.defaultMethod;
        }

        const response = await retry(
            async () => {
                const res = await fetch(`${this.cfg.baseUrl}/v3/payment/sessions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "api-key": this.cfg.apiKey,
                        "apikey": this.cfg.apiKey,
                        "Authorization": this.cfg.secretKey,
                    },
                    body: JSON.stringify(body),
                });
                if (res.status >= 500) {
                    throw new Error(`kashier ${res.status}: ${await res.text().catch(() => "")}`);
                }
                if (!res.ok) {
                    // Non-retryable upstream error (4xx) — surface verbatim.
                    const text = await res.text().catch(() => "");
                    const err = new Error(`kashier ${res.status}: ${text}`);
                    (err as any).statusCode = res.status;
                    (err as any).retryable = false;
                    throw err;
                }
                return (await res.json()) as KashierCreateSessionResponse;
            },
            {
                attempts: 3,
                initialDelayMs: 200,
                maxDelayMs: 1500,
                isRetryable: (err) => (err as any)?.retryable !== false,
            },
        );

        if (!response?._id || !response?.sessionUrl) {
            throw new Error(`kashier: malformed session response: ${JSON.stringify(response)}`);
        }

        return {
            providerSessionId: response._id,
            redirectUrl: response.sessionUrl,
            sessionId: response._id,
            sessionUrl: response.sessionUrl,
            rawResponse: response,
            expiresAt: response.expireAt ?? expireAt,
        };
    }

    verifyWebhook(input: VerifyWebhookInput): boolean {
        return verifyWebhookSignature(
            input.payload,
            input.signatureKeys,
            this.cfg.apiKey,
            input.signature,
        );
    }

    verifyWebhookSignature(signature: string, payload: any): boolean {
        const data = payload?.data ?? payload;
        return verifyWebhookSignature(signature, data, this.cfg.apiKey);
    }

    async refund(input: RefundInput): Promise<RefundResult> {
        const body: any = {
            apiOperation: "REFUND",
            reason: input.reason ?? "Order refund",
            transaction: {
                amount: typeof input.amount === "string" ? parseFloat(input.amount) : input.amount,
                currency: input.currency,
            },
        };
        if (input.targetTransactionId) {
            body.transaction.targetTransactionId = input.targetTransactionId;
        }

        const baseUrl = this.cfg.fepBaseUrl || env.kashier.fepBaseUrl || this.cfg.baseUrl;
        const response = await retry(
            async () => {
                const res = await fetch(`${baseUrl}/v3/orders/${input.kashierOrderId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "accept": "application/json",
                        "Authorization": this.cfg.secretKey,
                    },
                    body: JSON.stringify(body),
                });
                if (res.status >= 500) {
                    throw new Error(`kashier refund ${res.status}: ${await res.text().catch(() => "")}`);
                }
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    const err = new Error(`kashier refund ${res.status}: ${text}`);
                    (err as any).statusCode = res.status;
                    (err as any).retryable = false;
                    throw err;
                }
                return await res.json().catch(() => ({}));
            },
            {
                attempts: 3,
                initialDelayMs: 200,
                maxDelayMs: 1500,
                isRetryable: (err) => (err as any)?.retryable !== false,
            },
        );

        return {
            providerRefundId:
                (response as any)?.response?.transactionId ??
                (response as any)?.data?.transactionId ??
                (response as any)?.transactionId ??
                (response as any)?._id,
            rawResponse: response,
        };
    }
}
