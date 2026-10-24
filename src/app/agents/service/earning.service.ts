import { inject, injectable } from "tsyringe";
import { TOKENS } from "../../../lib/di/tokens";
import { Logger } from "../../../lib/logger/logger";
import { db } from "../../../lib/knex/knex";
import { findEarningsByAgent, sumEarningsByAgent } from "../repository/agent-earning.repo";
import { findOrderByPublicId, findOrderById } from "../../orders/repository/order.repo";
import { AgentEarningsResponseDTO } from "../dto/agent-response.dto";

@injectable()
export class EarningService {
    constructor(
        @inject(TOKENS.Logger) private readonly logger: Logger
    ) {}

    async listEarnings(
        agentId: number,
        region: string,
        query: { from?: string; to?: string; cursor?: string; limit?: number }
    ): Promise<AgentEarningsResponseDTO> {
        const conn = db(region);

        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const fromDate = query.from ? new Date(query.from) : startOfMonth;
        const toDate = query.to ? new Date(query.to) : now;

        const { earnings, nextCursor } = await findEarningsByAgent(agentId, fromDate, toDate, query, conn);
        const { count, sum } = await sumEarningsByAgent(agentId, fromDate, toDate, conn);

        // Map items
        const items = await Promise.all(
            earnings.map(async (e) => {
                const order = await findOrderById(e.orderId, conn);
                return {
                    orderPublicId: order ? order.publicId : String(e.orderId),
                    amount: e.amount,
                    currency: e.currency,
                    earnedAt: e.earnedAt ? e.earnedAt.toISOString() : now.toISOString(),
                };
            })
        );

        return {
            range: {
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
            },
            totals: {
                count,
                sum,
                currency: earnings[0]?.currency || "EGP",
            },
            items,
            nextCursor,
        };
    }
}
