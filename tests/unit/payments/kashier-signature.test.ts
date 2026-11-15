import {
    buildSignaturePayload,
    computeWebhookSignature,
    verifyWebhookSignature,
} from "../../../src/pkg/payments/kashier/kashier.signature";

describe("Kashier Signature Tests", () => {
    const apiKey = "test-kashier-secret-key";

    it("builds sorted URL-encoded signature payload from signatureKeys", () => {
        const data = {
            status: "SUCCESS",
            amount: "150.00",
            merchantOrderId: "order 123|eg",
            signatureKeys: ["status", "amount", "merchantOrderId"],
        };

        const payload = buildSignaturePayload(data);
        expect(payload).toBe("amount=150.00&merchantOrderId=order%20123%7Ceg&status=SUCCESS");
    });

    it("computes and verifies a valid webhook signature", () => {
        const data = {
            paymentStatus: "SUCCESS",
            amount: "250.50",
            currency: "EGP",
            merchantOrderId: "abc-123",
            signatureKeys: ["paymentStatus", "amount", "currency", "merchantOrderId"],
        };

        const signature = computeWebhookSignature(data, apiKey);
        expect(verifyWebhookSignature(signature, data, apiKey)).toBe(true);
    });

    it("rejects a tampered payload or invalid signature", () => {
        const data = {
            paymentStatus: "SUCCESS",
            amount: "250.50",
            signatureKeys: ["paymentStatus", "amount"],
        };

        const signature = computeWebhookSignature(data, apiKey);
        const tampered = { ...data, amount: "999.99" };

        expect(verifyWebhookSignature(signature, tampered, apiKey)).toBe(false);
        expect(verifyWebhookSignature("deadbeef", data, apiKey)).toBe(false);
        expect(verifyWebhookSignature("", data, apiKey)).toBe(false);
    });
});

