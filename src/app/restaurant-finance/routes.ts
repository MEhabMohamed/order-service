import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../lib/auth/guard";
import { requireRegion } from "../../lib/sharding/region-resolver";
import { idempotency } from "../../lib/idempotency/idempotency";
import { container } from "../../lib/di/container";
import { TOKENS } from "../../lib/di/tokens";
import { FinanceController } from "./controller/finance.controller";

export const financeRouter = Router();

const financeController = container.resolve<FinanceController>(TOKENS.FinanceController);

function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (req.user?.role !== "system_admin") {
        return res.status(403).json({ error: "System admin access required" });
    }
    next();
}

financeRouter.get(
    "/restaurant/balance",
    authenticate,
    requireRegion,
    financeController.getBalance
);

financeRouter.get(
    "/restaurant/payouts",
    authenticate,
    requireRegion,
    financeController.listPayouts
);

financeRouter.post(
    "/restaurant/payouts",
    authenticate,
    requireRegion,
    requireAdmin,
    idempotency({ strict: true }),
    financeController.recordPayout
);
