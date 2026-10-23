import crypto from "crypto";
import { KashierWebhookData } from "./kashier.types";

/**
 * Builds the canonical signature payload string according to Kashier documentation:
 * 1. Sort data.signatureKeys alphabetically.
 * 2. Select corresponding key-values from data.
 * 3. URL-encode each value (values only, not keys).
 * 4. Join key=value with '&'.
 */
export function buildSignaturePayload(data: KashierWebhookData): string {
    if (!data.signatureKeys || !Array.isArray(data.signatureKeys)) {
        throw new Error("Missing signatureKeys array in Kashier webhook data");
    }

    const sortedKeys = [...data.signatureKeys].sort();
    const pairs: string[] = [];

    for (const key of sortedKeys) {
        const rawValue = data[key];
        const stringValue = rawValue !== undefined && rawValue !== null ? String(rawValue) : "";
        const encodedValue = encodeURIComponent(stringValue);
        pairs.push(`${key}=${encodedValue}`);
    }

    return pairs.join("&");
}

/**
 * Computes the HMAC-SHA256 signature for the Kashier webhook data using the merchant Payment API Key.
 */
export function computeWebhookSignature(data: KashierWebhookData, apiKey: string): string {
    const payload = buildSignaturePayload(data);
    return crypto.createHmac("sha256", apiKey).update(payload).digest("hex");
}

/**
 * Verifies that the provided x-kashier-signature header matches the computed HMAC-SHA256.
 */
export function verifyWebhookSignature(
    signatureHeader: string | undefined | null,
    data: KashierWebhookData,
    apiKey: string
): boolean {
    if (!signatureHeader || !data || !apiKey) {
        return false;
    }

    try {
        const expected = computeWebhookSignature(data, apiKey).toLowerCase();
        const actual = signatureHeader.trim().toLowerCase();

        if (expected.length !== actual.length) {
            return false;
        }

        const expectedBuf = Buffer.from(expected, "utf8");
        const actualBuf = Buffer.from(actual, "utf8");

        return crypto.timingSafeEqual(expectedBuf, actualBuf);
    } catch {
        return false;
    }
}
