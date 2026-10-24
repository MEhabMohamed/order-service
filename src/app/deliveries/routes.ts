import { Router } from "express";
import { authenticate } from "../../lib/auth/guard";
import { requireRegion } from "../../lib/sharding/region-resolver";
import { idempotency } from "../../lib/idempotency/idempotency";
import { container } from "../../lib/di/container";
import { TOKENS } from "../../lib/di/tokens";
import { DeliveryController } from "./controller/delivery.controller";

export const deliveryRouter = Router();

const deliveryController = container.resolve<DeliveryController>(TOKENS.DeliveryController);

deliveryRouter.post(
    "/deliveries/assign/:orderId",
    authenticate,
    requireRegion,
    idempotency({ strict: true }),
    deliveryController.assign
);

deliveryRouter.post(
    "/deliveries/reassign/:orderId",
    authenticate,
    requireRegion,
    idempotency({ strict: true }),
    deliveryController.reassign
);

deliveryRouter.patch(
    "/deliveries/:orderId/status",
    authenticate,
    requireRegion,
    idempotency({ strict: true }),
    deliveryController.updateStatus
);
