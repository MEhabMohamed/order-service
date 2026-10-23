import { Router } from "express";
import { authenticate } from "../../lib/auth/guard";
import { requireRegion } from "../../lib/sharding/region-resolver";
import { idempotency } from "../../lib/idempotency/idempotency";
import { withCache } from "../../lib/cache/withCache";
import { container } from "../../lib/di/container";
import { TOKENS } from "../../lib/di/tokens";
import { OrderController } from "./controller/order.controller";

export const orderRouter = Router();

const orderController = container.resolve<OrderController>(TOKENS.OrderController);

// Place order
orderRouter.post(
    "/orders",
    authenticate,
    requireRegion,
    idempotency({ strict: true }),
    orderController.placeOrder
);

// Get single order
orderRouter.get(
    "/orders/:publicId",
    authenticate,
    requireRegion,
    orderController.getOrder
);

// Customer order list
orderRouter.get(
    "/customer/orders",
    authenticate,
    requireRegion,
    orderController.listCustomerOrders
);

// Restaurant order list (cached 10s)
orderRouter.get(
    "/restaurant/orders",
    authenticate,
    requireRegion,
    withCache(10),
    orderController.listRestaurantOrders
);

// Update order status
orderRouter.patch(
    "/orders/:publicId/status",
    authenticate,
    requireRegion,
    idempotency({ strict: true }),
    orderController.updateStatus
);
