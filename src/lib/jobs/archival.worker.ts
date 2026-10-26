import { db, dbArchive } from "../knex/knex";
import { redisClient } from "../cache/init";
import { logger } from "../logger/logger";
import { env } from "../config/env";
import { toMs } from "../../pkg/utils/time";
import { register } from "./job-registry";

export async function runArchival(
    targetRegion?: string
): Promise<{ archivedOrders: number; archivedTransactions: number }> {
    const regions = targetRegion ? [targetRegion] : env.regions;
    let totalArchivedOrders = 0;
    let totalArchivedTransactions = 0;

    const currentYear = new Date().getUTCFullYear();
    const cutoffDate = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0, 0));

    for (const region of regions) {
        const lockKey = `archival:${region}:lock`;
        // Acquire distributed lock for 1 hour (3600 seconds)
        const acquired = await redisClient.set(lockKey, "1", "EX", 3600, "NX").catch(() => null);
        if (!acquired) {
            logger.info("Archival skipped — lock already held by another worker", { region });
            continue;
        }

        try {
            logger.info("Starting cold archival run", { region, cutoffDate: cutoffDate.toISOString() });
            const hot = db(region);
            const archive = dbArchive(region);

            let hasMoreOrders = true;
            while (hasMoreOrders) {
                // Fetch completed orders older than cutoffDate
                const eligibleOrders = await hot("orders")
                    .where("created_at", "<", cutoffDate)
                    .whereIn("status", ["delivered", "cancelled", "rejected"])
                    .orderBy("id", "asc")
                    .limit(1000)
                    .catch((err) => {
                        logger.warn("Could not query hot orders for archival", { error: err.message });
                        return [];
                    });

                if (eligibleOrders.length === 0) {
                    hasMoreOrders = false;
                    break;
                }

                const orderIds = eligibleOrders.map((o: any) => o.id);

                // Fetch child records
                const items = await hot("order_items").whereIn("order_id", orderIds).catch(() => []);
                const txs = await hot("transactions").whereIn("order_id", orderIds).catch(() => []);
                const earnings = await hot("agent_earnings").whereIn("order_id", orderIds).catch(() => []);

                // Copy to Archive (parent first, then children to satisfy FK constraints)
                try {
                    await archive("orders").insert(eligibleOrders).onConflict(["id", "created_at"]).ignore();
                    if (items.length > 0) {
                        await archive("order_items").insert(items).onConflict(["id", "order_created_at"]).ignore();
                    }
                    if (txs.length > 0) {
                        await archive("transactions").insert(txs).onConflict("id").ignore();
                    }
                    if (earnings.length > 0) {
                        await archive("agent_earnings").insert(earnings).onConflict("id").ignore();
                    }
                } catch (archiveErr: any) {
                    logger.error("Failed writing records to archive shard", { region, error: archiveErr.message });
                    break; // abort this batch to prevent premature deletion from hot
                }

                // Prune from Hot (children first, then parent to satisfy FK constraints)
                if (earnings.length > 0) {
                    await hot("agent_earnings").whereIn("id", earnings.map((e: any) => e.id)).delete().catch(() => {});
                }
                if (txs.length > 0) {
                    await hot("transactions").whereIn("id", txs.map((t: any) => t.id)).delete().catch(() => {});
                }
                if (items.length > 0) {
                    await hot("order_items").whereIn("id", items.map((i: any) => i.id)).delete().catch(() => {});
                }
                await hot("orders").whereIn("id", orderIds).delete().catch(() => {});

                totalArchivedOrders += eligibleOrders.length;
                if (eligibleOrders.length < 1000) {
                    hasMoreOrders = false;
                }
            }

            // Archival of standalone transactions (payouts or adjustments without order_id)
            let hasMoreTxs = true;
            while (hasMoreTxs) {
                const eligibleTxs = await hot("transactions")
                    .where("created_at", "<", cutoffDate)
                    .whereNull("order_id")
                    .orderBy("id", "asc")
                    .limit(1000)
                    .catch(() => []);

                if (eligibleTxs.length === 0) {
                    hasMoreTxs = false;
                    break;
                }

                try {
                    await archive("transactions").insert(eligibleTxs).onConflict("id").ignore();
                    await hot("transactions").whereIn("id", eligibleTxs.map((t: any) => t.id)).delete();
                    totalArchivedTransactions += eligibleTxs.length;
                } catch (txArchiveErr: any) {
                    logger.warn("Archival of standalone transactions failed", { error: txArchiveErr.message });
                    break;
                }

                if (eligibleTxs.length < 1000) {
                    hasMoreTxs = false;
                }
            }

            logger.info("Cold archival run complete", { region, totalArchivedOrders, totalArchivedTransactions });
        } catch (err: any) {
            logger.error("Archival run encountered error", { region, error: err.message });
        } finally {
            await redisClient.del(lockKey).catch(() => {});
        }
    }

    return { archivedOrders: totalArchivedOrders, archivedTransactions: totalArchivedTransactions };
}

let timerHandle: NodeJS.Timeout | null = null;
let intervalHandle: NodeJS.Timeout | null = null;

export function msUntilNext0300UTC(from: Date = new Date()): number {
    const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 3, 0, 0, 0));
    if (next.getTime() <= from.getTime()) {
        next.setUTCDate(next.getUTCDate() + 1);
    }
    return next.getTime() - from.getTime();
}

export function startArchivalWorker(): { stop: () => void } {
    const initialDelayMs = msUntilNext0300UTC();
    logger.info("Cold archival worker scheduled", {
        nextRunInMs: initialDelayMs,
        scheduledAtUTC: new Date(Date.now() + initialDelayMs).toISOString(),
    });

    timerHandle = setTimeout(() => {
        runArchival().catch((err) => {
            logger.error("Scheduled archival job failed", { error: err.message });
        });

        // Run every 24 hours
        intervalHandle = setInterval(() => {
            runArchival().catch((err) => {
                logger.error("Scheduled archival job failed", { error: err.message });
            });
        }, toMs.day(1));
    }, initialDelayMs);

    return {
        stop: () => {
            if (timerHandle) clearTimeout(timerHandle);
            if (intervalHandle) clearInterval(intervalHandle);
            logger.info("Cold archival worker stopped");
        },
    };
}

export function registerArchivalJobs(): void {
    register({
        name: "cold-archival",
        cron: "0 3 * * *", // 03:00 UTC daily
        timezone: "UTC",
        handler: async () => {
            await runArchival();
        },
    });
}

