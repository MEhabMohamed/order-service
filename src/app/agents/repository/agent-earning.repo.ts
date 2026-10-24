import { Knex } from "knex";
import { AgentEarningEntity } from "../entity/agent-earning.entity";
import { decodeCursor, encodeCursor } from "../../../lib/http/pagination/cursor-pagination";

function toEntity(row: any): AgentEarningEntity {
    return new AgentEarningEntity({
        id: Number(row.id),
        region: row.region,
        agentId: Number(row.agent_id),
        orderId: Number(row.order_id),
        orderCreatedAt: new Date(row.order_created_at),
        amount: Number(row.amount),
        currency: row.currency,
        earnedAt: row.earned_at ? new Date(row.earned_at) : undefined,
    });
}

export async function createEarning(
    data: Partial<AgentEarningEntity>,
    conn: Knex
): Promise<AgentEarningEntity> {
    const now = data.earnedAt || new Date();
    const [row] = await conn("agent_earnings")
        .insert({
            region: data.region,
            agent_id: data.agentId,
            order_id: data.orderId,
            order_created_at: data.orderCreatedAt,
            amount: data.amount,
            currency: data.currency,
            earned_at: now,
        })
        .returning("*");

    return toEntity(row);
}

export async function findEarningsByAgent(
    agentId: number,
    from: Date,
    to: Date,
    query: { cursor?: string; limit?: number },
    conn: Knex
): Promise<{ earnings: AgentEarningEntity[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    let qb = conn("agent_earnings")
        .where({ agent_id: agentId })
        .where("earned_at", ">=", from)
        .where("earned_at", "<=", to)
        .orderBy("earned_at", "desc")
        .orderBy("id", "desc")
        .limit(limit + 1);

    if (query.cursor) {
        const decoded = decodeCursor(query.cursor);
        if (decoded && decoded.createdAt && decoded.id) {
            qb = qb.where((builder) => {
                builder
                    .where("earned_at", "<", decoded.createdAt)
                    .orWhere((b2) => {
                        b2.where("earned_at", "=", decoded.createdAt).andWhere("id", "<", decoded.id);
                    });
            });
        }
    }

    const rows = await qb;
    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    const earnings = resultRows.map(toEntity);
    const lastItem = earnings[earnings.length - 1];
    const nextCursor = hasMore && lastItem && lastItem.earnedAt && lastItem.id
        ? encodeCursor({ createdAt: lastItem.earnedAt.toISOString(), id: lastItem.id })
        : null;

    return { earnings, nextCursor, hasMore };
}

export async function sumEarningsByAgent(
    agentId: number,
    from: Date,
    to: Date,
    conn: Knex
): Promise<{ count: number; sum: number }> {
    const res = await conn("agent_earnings")
        .where({ agent_id: agentId })
        .where("earned_at", ">=", from)
        .where("earned_at", "<=", to)
        .select(
            conn.raw("COUNT(id) as count"),
            conn.raw("COALESCE(SUM(amount), 0) as sum")
        )
        .first();

    return {
        count: Number((res as any)?.count || 0),
        sum: Number((res as any)?.sum || 0),
    };
}
