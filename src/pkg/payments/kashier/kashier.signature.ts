import { createHmac, timingSafeEqual } from "crypto";

/**
 * Kashier webhook signature verification.
 *
 * Per https://developers.kashier.io/webhooks/setup and verified against live
 * webhooks:
 *   1. Read `signatureKeys` from the inbound `data` object.
 *   2. Sort the field names alphabetically.
 *   3. Build `key=encodeURIComponent(value)&...` joined with `&`. Values
 *      MUST be URL-encoded — Kashier signs the encoded form, so unencoded
 *      strings with spaces/colons/pipes produce a different digest.
 *   4. HMAC-SHA256 with the Payment API Key as the secret.
 *   5. Compare the hex digest with the `x-kashier-signature` header using timingSafeEqual.
 */
export function buildSignaturePayload(
    data: Record<string, unknown>,
    signatureKeys?: string[],
): string {
    const keys = (signatureKeys ?? (data.signatureKeys as string[]) ?? Object.keys(data).filter(k => k !== "signatureKeys"));
    return [...keys]
        .sort()
        .map((k) => {
            const v = data[k];
            const stringified = v === undefined || v === null ? "" : String(v);
            return `${k}=${encodeURIComponent(stringified)}`;
        })
        .join("&");
}

export function computeWebhookSignature(data: Record<string, unknown>, apiKey: string): string;
export function computeWebhookSignature(data: Record<string, unknown>, signatureKeys: string[], apiKey: string): string;
export function computeWebhookSignature(
    data: Record<string, unknown>,
    arg2: string[] | string,
    arg3?: string,
): string {
    let signatureKeys: string[];
    let apiKey: string;
    if (Array.isArray(arg2)) {
        signatureKeys = arg2;
        apiKey = arg3!;
    } else {
        apiKey = arg2;
        signatureKeys = (data.signatureKeys as string[]) ?? [];
    }
    const payload = buildSignaturePayload(data, signatureKeys);
    return createHmac("sha256", apiKey).update(payload, "utf8").digest("hex");
}

export function verifyWebhookSignature(providedSignature: string, data: Record<string, unknown>, apiKey: string): boolean;
export function verifyWebhookSignature(data: Record<string, unknown>, signatureKeys: string[], apiKey: string, providedSignature: string): boolean;
export function verifyWebhookSignature(
    arg1: any,
    arg2: any,
    arg3: any,
    arg4?: any,
): boolean {
    let data: Record<string, unknown>;
    let signatureKeys: string[];
    let apiKey: string;
    let providedSignature: string;

    if (typeof arg1 === "string" && typeof arg2 === "object") {
        // (providedSignature, data, apiKey)
        providedSignature = arg1;
        data = arg2;
        apiKey = arg3;
        signatureKeys = (data.signatureKeys as string[]) ?? [];
    } else {
        // (data, signatureKeys, apiKey, providedSignature)
        data = arg1;
        signatureKeys = arg2;
        apiKey = arg3;
        providedSignature = arg4;
    }

    if (!providedSignature || typeof providedSignature !== "string") return false;
    const expected = computeWebhookSignature(data, signatureKeys, apiKey);
    if (expected.length !== providedSignature.length) return false;
    try {
        return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(providedSignature, "hex"));
    } catch {
        return false;
    }
}
