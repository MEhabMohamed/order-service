import { Router } from "express";
import { authenticate } from "../../lib/auth/guard";
import { rbac } from "../../lib/auth/rbac";
import { idempotency } from "../../lib/idempotency/idempotency";
import { requireRegion } from "../../lib/sharding/region-resolver";
import { container } from "../../lib/di/container";
import { TOKENS } from "../../lib/di/tokens";
import { PaymentController } from "./controller/payment.controller";
import { WebhookController } from "./controller/webhook.controller";

export const paymentRouter = Router();

const paymentController = container.resolve<PaymentController>(TOKENS.PaymentController);
const webhookController = container.resolve<WebhookController>(TOKENS.WebhookController);

// Init payment session (Customer)
paymentRouter.post(
    "/payments/init",
    authenticate,
    requireRegion,
    idempotency({ strict: true }),
    paymentController.init
);

// Payment webhooks (Public / Kashier, verified by HMAC signature)
paymentRouter.post(
    "/payments/webhook/:provider",
    webhookController.handleWebhook
);

// Get payment detail
paymentRouter.get(
    "/payments/:paymentId",
    authenticate,
    requireRegion,
    rbac({ resource: "payments", action: "read" }),
    paymentController.getPayment
);

// Refund payment (Admin only)
paymentRouter.post(
    "/payments/:paymentId/refund",
    authenticate,
    requireRegion,
    idempotency({ strict: true }),
    rbac({ resource: "payments", action: "refund" }),
    paymentController.refund
);
