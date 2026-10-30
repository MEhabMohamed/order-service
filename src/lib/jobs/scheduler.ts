import { Cron } from "croner";
import { logger } from "../logger/logger";
import { listJobs } from "./job-registry";

const tasks: Cron[] = [];

/**
 * Boot every registered job. Each handler invocation is wrapped so a thrown
 * error doesn't tear down the cron task — the next tick still runs.
 *
 * Concurrent invocations of the same job are dropped: if a tick is still
 * running when the next fires, that tick is skipped (logged at debug).
 */
export function startAll(): void {
    const running = new Set<string>();
    for (const job of listJobs()) {
        try {
            const task = new Cron(
                job.cron,
                { timezone: job.timezone, protect: true },
                async () => {
                    if (running.has(job.name)) {
                        logger.debug("job skipped (previous tick still running)", { job: job.name });
                        return;
                    }
                    running.add(job.name);
                    const start = Date.now();
                    try {
                        await job.handler();
                    } catch (err) {
                        logger.error("job failed", { job: job.name, error: (err as Error).message });
                    } finally {
                        running.delete(job.name);
                        logger.debug("job tick", { job: job.name, ms: Date.now() - start });
                    }
                },
            );
            tasks.push(task);
            logger.info("job scheduled", { name: job.name, cron: job.cron });
        } catch (err) {
            throw new Error(`invalid cron expression for job ${job.name}: ${job.cron} (${(err as Error).message})`);
        }
    }
}

/** Stop all scheduled tasks. Called from the worker's SIGINT/SIGTERM handler. */
export async function stopAll(): Promise<void> {
    for (const t of tasks) {
        try {
            t.stop();
        } catch { }
    }
    tasks.length = 0;
}
