import { db } from "../knex/knex";
import { env } from "../config/env";
import { logger } from "../logger/logger";
import { messageBroker } from "../messaging/init";
import { claimBatch, markDispatchedBatch, markFailedBatch } from "./outbox.repo";

/**
 * One pass over a single region's outbox: claim a batch with FOR UPDATE
 * SKIP LOCKED, publish all rows concurrently to the order.events exchange
 * (`Promise.allSettled`), and update dispatched/failed status in bulk
 * (`markDispatchedBatch` / `markFailedBatch`) so no `for` loop ever executes
 * N+1 sequential queries or I/O calls.
 *
 * SKIP LOCKED makes this safe to run concurrently across multiple workers in
 * the same region.
 */
export async function drainOutboxForRegion(region: string): Promise<void> {
    const conn = db(region);
    const trx = await conn.transaction();
    try {
        const rows = await claimBatch(trx, env.outboundEvents.batchSize);
        if (rows.length === 0) {
            await trx.commit();
            return;
        }

        const nowIso = new Date().toISOString();
        const results = await Promise.allSettled(
            rows.map(async (row) => {
                const envelope = {
                    eventId: row.event_id,
                    eventType: row.event_type,
                    occurredAt: nowIso,
                    aggregateType: row.aggregate_type,
                    aggregateId: row.aggregate_id,
                    region,
                    payload: row.payload,
                };
                await messageBroker.publish(
                    env.outboundEvents.exchange,
                    row.event_type,
                    Buffer.from(JSON.stringify(envelope), "utf8"),
                );
                return row.id;
            }),
        );

        const dispatchedIds: string[] = [];
        const failedIds: string[] = [];
        let firstErrorMsg = "";

        results.forEach((res, idx) => {
            if (res.status === "fulfilled") {
                dispatchedIds.push(res.value);
            } else {
                const rowId = rows[idx].id;
                const msg = describeError(res.reason);
                failedIds.push(rowId);
                if (!firstErrorMsg) firstErrorMsg = msg;
                logger.error("outbox publish failed", { region, id: rowId, error: msg });
            }
        });

        if (dispatchedIds.length > 0) {
            await markDispatchedBatch(trx, dispatchedIds);
        }
        if (failedIds.length > 0) {
            await markFailedBatch(trx, failedIds, firstErrorMsg);
        }

        await trx.commit();
    } catch (err) {
        await trx.rollback();
        throw err;
    }
}

function describeError(err: unknown): string {
    if (err instanceof Error && err.message) return err.message;
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}
