import type {Request, Response, NextFunction} from "express";
import {isRegion, normalizeRegion} from "./regions";
import {RegionNotResolvedError} from "./errors";

/**
 * Resolves the target region for a request.
 * Resolution precedence:
 *   1. `?region=` query string (e.g. external webhooks or explicit overrides)
 *   2. Authenticated user's JWT region (if set on req.user)
 *   3. `X-Region` header (standard client header)
 *
 * "all" is preserved for admin fan-out reads; routes that need a single
 * shard should additionally use `requireConcreteRegion`.
 */
export function resolveRegion(req: Request, _res: Response, next: NextFunction) {
    const queryValue = typeof req.query?.region === "string" ? req.query.region : undefined;
    const userValue = typeof req.user?.region === "string" ? req.user.region : undefined;
    const headerRaw = req.headers?.["x-region"];
    const headerValue = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;

    const norm = normalizeRegion(queryValue ?? userValue ?? headerValue);
    if (norm === "all") {
        req.region = "all";
    } else if (norm && isRegion(norm)) {
        req.region = norm;
    }
    next();
}

export function requireRegion(req: Request, _res: Response, next: NextFunction) {
    if (!req.region) throw RegionNotResolvedError;
    next();
}

/**
 * Stricter than `requireRegion`: rejects `req.region === "all"` so that
 * single-shard endpoints (writes, lookups by id) never silently fan out.
 */
export function requireConcreteRegion(req: Request, _res: Response, next: NextFunction) {
    if (!req.region || req.region === "all") throw RegionNotResolvedError;
    next();
}
