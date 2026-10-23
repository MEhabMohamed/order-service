import { Router } from "express";
import { healthRouter } from "./app/health/health.routes";
import { orderRouter } from "./app/orders/routes";

export const routes = Router();

routes.use("/health", healthRouter);
routes.use("/", orderRouter);
