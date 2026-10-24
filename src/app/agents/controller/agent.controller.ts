import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "../../../lib/di/tokens";
import { AgentService } from "../service/agent.service";
import { EarningService } from "../service/earning.service";
import { OrderStatus } from "../../orders/enums";
import { sendPaginated, sendSuccess } from "../../../lib/http/response";

@injectable()
export class AgentController {
    constructor(
        @inject(TOKENS.AgentService) private readonly agentService: AgentService,
        @inject(TOKENS.EarningService) private readonly earningService: EarningService
    ) {}

    getTasks = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const region = (req as any).region;
            const status = req.query.status as OrderStatus | undefined;
            const cursor = req.query.cursor as string | undefined;
            const limit = req.query.limit ? Number(req.query.limit) : undefined;

            const { tasks, nextCursor, hasMore } = await this.agentService.listTasks(
                user.userId,
                region,
                { status, cursor, limit }
            );

            return sendPaginated(res, tasks, { nextCursor, hasMore, count: tasks.length });
        } catch (err) {
            next(err);
        }
    };

    getEarnings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const region = (req as any).region;
            const from = req.query.from as string | undefined;
            const to = req.query.to as string | undefined;
            const cursor = req.query.cursor as string | undefined;
            const limit = req.query.limit ? Number(req.query.limit) : undefined;

            const result = await this.earningService.listEarnings(
                user.userId,
                region,
                { from, to, cursor, limit }
            );

            return sendSuccess(res, result, 200);
        } catch (err) {
            next(err);
        }
    };
}
