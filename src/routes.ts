import { Router } from "express";
import { healthRouter } from "./app/health/health.routes";
import { orderRouter } from "./app/orders/routes";
import { paymentRouter } from "./app/payments/routes";
import { deliveryRouter } from "./app/deliveries/routes";
import { agentRouter } from "./app/agents/routes";
import { financeRouter } from "./app/restaurant-finance/routes";

export const routes = Router();

routes.use("/health", healthRouter);
routes.use("/", orderRouter);
routes.use("/", paymentRouter);
routes.use("/", deliveryRouter);
routes.use("/", agentRouter);
routes.use("/", financeRouter);


