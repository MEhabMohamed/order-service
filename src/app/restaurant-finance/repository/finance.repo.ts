import { Knex } from "knex";
import { TransactionEntity } from "../../payments/entity/transaction.entity";
import { TransactionType } from "../../payments/enums";

function toTransactionEntity(row: any): TransactionEntity {
    return TransactionEntity.toEntity(row);
}

function encodeCursor(createdAt: Date, id: number): string {
    return Buffer.from(`${createdAt.toISOString()}:${id}`).toString("base64");
}

function decodeCursor(cursor: string): { createdAt: Date; id: number } | null {
    try {
        const decoded = Buffer.from(cursor, "base64").toString("utf8");
        const [ts, idStr] = decoded.split(":");
        const d = new Date(ts);
        const id = Number(idStr);
        if (isNaN(d.getTime()) || isNaN(id)) return null;
        return { createdAt: d, id };
    } catch {
        return null;
    }
}

export async function findPayouts(
    restaurantId: number,
    query: { from?: Date; to?: Date; cursor?: string; limit?: number },
    conn: Knex
): Promise<{ payouts: TransactionEntity[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    let qb = conn("transactions")
        .where({
            dst_acc_id: restaurantId,
            transaction_type: TransactionType.PAYOUT,
        })
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(limit + 1);

    if (query.from) {
        qb = qb.where("created_at", ">=", query.from);
    }
    if (query.to) {
        qb = qb.where("created_at", "<=", query.to);
    }

    if (query.cursor) {
        const decoded = decodeCursor(query.cursor);
        if (decoded && decoded.createdAt && decoded.id) {
            qb = qb.where((builder) => {
                builder
                    .where("created_at", "<", decoded.createdAt)
                    .orWhere((b2) => {
                        b2.where("created_at", "=", decoded.createdAt).andWhere("id", "<", decoded.id);
                    });
            });
        }
    }

    const rows = await qb;
    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    const payouts = resultRows.map(toTransactionEntity);

    let nextCursor: string | null = null;
    if (hasMore && payouts.length > 0) {
        const last = payouts[payouts.length - 1];
        if (last.createdAt && last.id) {
            nextCursor = encodeCursor(last.createdAt, last.id);
        }
    }

    return { payouts, nextCursor, hasMore };
}
