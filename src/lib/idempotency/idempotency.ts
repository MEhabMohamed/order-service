import { Request, Response, NextFunction } from "express";
import { ICacheProvider } from "../../pkg/cache/cache.interface";
import { container } from "../di/container";
import { TOKENS } from "../di/tokens";
import { toSec } from "../../pkg/utils/time";
import { tryGetIdempotentRecord, storeIdempotentRecord, hashParams } from "./idempotency-store";

const TTL = toSec.day(1);

interface IdempotencyOptions {
    strict?: boolean;
}

export function idempotency(options: IdempotencyOptions = {}) {
    const { strict = false } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
        if (!["POST", "PATCH", "PUT"].includes(req.method)) return next();

        const idempotencyKey = req.headers["idempotency-key"];

        if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
            if (strict) {
                return res.status(400).json({ error: "Missing Idempotency-Key header" });
            }
            return next();
        }

        const region = req.region;
        const currentHash = hashParams(req.body);
        const cacheProvider = container.resolve<ICacheProvider>(TOKENS.CacheProvider);
        const key = `idempotency:${req.method}:${req.originalUrl}:${idempotencyKey}`;

        try {
            // 1. Check Redis first
            const cached = await cacheProvider.get(key);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.bodyHash && parsed.bodyHash !== currentHash) {
                    return res.status(409).json({ error: "IdempotencyConflict" });
                }
                return res.status(parsed.statusCode || 200).json(parsed.body);
            }

            // 2. Check DB fallback if region is resolved
            if (region && region !== "all") {
                const dbRecord = await tryGetIdempotentRecord(idempotencyKey, region);
                if (dbRecord) {
                    const dbHash = hashParams(dbRecord.requestParams);
                    if (dbHash !== currentHash) {
                        return res.status(409).json({ error: "IdempotencyConflict" });
                    }
                    // Re-populate Redis
                    cacheProvider.set(key, JSON.stringify({
                        bodyHash: dbHash,
                        statusCode: dbRecord.responseCode,
                        body: dbRecord.responseBody
                    }), TTL).catch(() => { });

                    return res.status(dbRecord.responseCode).json(dbRecord.responseBody);
                }
            }

            // 3. Intercept response to store both in Redis and DB
            const originalJson = res.json.bind(res);
            res.json = ((body: unknown) => {
                const statusCode = res.statusCode || 200;
                cacheProvider.set(key, JSON.stringify({
                    bodyHash: currentHash,
                    statusCode,
                    body
                }), TTL).catch(() => { });

                if (region && region !== "all") {
                    storeIdempotentRecord({
                        key: idempotencyKey,
                        region,
                        requestPath: req.originalUrl,
                        requestParams: req.body,
                        responseCode: statusCode,
                        responseBody: body,
                    }).catch(() => { });
                }

                return originalJson(body);
            }) as Response["json"];

            next();
        } catch {
            if (strict) {
                return res.status(503).json({ error: "Idempotency service unavailable" });
            }
            next();
        }
    };
}
