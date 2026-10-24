import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "../../../lib/di/tokens";
import { FinanceService } from "../service/finance.service";
import { sendPaginated, sendSuccess } from "../../../lib/http/response";
import { UnauthorizedFinanceAccessError } from "../errors";

@injectable()
export class FinanceController {
    constructor(
        @inject(TOKENS.FinanceService) private readonly financeService: FinanceService
    ) {}

    getBalance = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const region = (req as any).region;
            const currency = req.query.currency as string | undefined;

            let restaurantId: number | undefined;
            if (user.role === "system_admin") {
                restaurantId = req.query.restaurantId ? Number(req.query.restaurantId) : undefined;
            } else if (user.role === "restaurant_user" && user.restaurantId) {
                restaurantId = Number(user.restaurantId);
            }

            if (!restaurantId) {
                throw new UnauthorizedFinanceAccessError();
            }

            const balances = await this.financeService.getBalance(restaurantId, region, currency);
            return sendSuccess(res, balances);
        } catch (err) {
            next(err);
        }
    };

    listPayouts = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const region = (req as any).region;
            const from = req.query.from as string | undefined;
            const to = req.query.to as string | undefined;
            const cursor = req.query.cursor as string | undefined;
            const limit = req.query.limit ? Number(req.query.limit) : undefined;

            let restaurantId: number | undefined;
            if (user.role === "system_admin") {
                restaurantId = req.query.restaurantId ? Number(req.query.restaurantId) : undefined;
            } else if (user.role === "restaurant_user" && user.restaurantId) {
                restaurantId = Number(user.restaurantId);
            }

            if (!restaurantId) {
                throw new UnauthorizedFinanceAccessError();
            }

            const { payouts, nextCursor, hasMore } = await this.financeService.listPayouts(
                restaurantId,
                region,
                { from, to, cursor, limit }
            );

            return sendPaginated(res, payouts, { nextCursor, hasMore, count: payouts.length });
        } catch (err) {
            next(err);
        }
    };

    recordPayout = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const region = (req as any).region;
            const idempotencyKey = (req as any).idempotencyKey;
            const body = req.body;

            const payout = await this.financeService.recordPayout(
                {
                    restaurantId: Number(body.restaurantId),
                    amount: Number(body.amount),
                    currency: String(body.currency),
                    providerReferenceId: body.providerReferenceId,
                    method: body.method,
                    note: body.note,
                },
                region,
                idempotencyKey
            );

            return sendSuccess(res, payout, 201);
        } catch (err) {
            next(err);
        }
    };
}
