import { Router } from "express";
import { healthRouter } from "./app/health/health.routes";
import { orderRouter } from "./app/orders/routes";
import { paymentRouter } from "./app/payments/routes";

export const routes = Router();

routes.use("/health", healthRouter);
routes.use("/", orderRouter);
routes.use("/", paymentRouter);

