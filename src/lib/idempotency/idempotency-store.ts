import crypto from "crypto";
import { db } from "../knex/knex";

export interface StoredIdempotencyRecord {
    key: string;
    region: string;
    requestPath: string;
    requestParams: any;
    responseCode: number;
    responseBody: any;
}

export function hashParams(params: any): string {
    return crypto.createHash("sha256").update(JSON.stringify(params || {})).digest("hex");
}

export async function tryGetIdempotentRecord(
    key: string,
    region: string
): Promise<StoredIdempotencyRecord | null> {
    try {
        const row = await db(region)("idempotency_keys")
            .where({ key, region })
            .first();

        if (!row || !row.response_code) return null;

        return {
            key: row.key,
            region: row.region,
            requestPath: row.request_path,
            requestParams: typeof row.request_params === "string" ? JSON.parse(row.request_params) : row.request_params,
            responseCode: row.response_code,
            responseBody: typeof row.response_body === "string" ? JSON.parse(row.response_body) : row.response_body,
        };
    } catch {
        return null;
    }
}

export async function storeIdempotentRecord(record: StoredIdempotencyRecord): Promise<void> {
    try {
        await db(record.region)("idempotency_keys")
            .insert({
                key: record.key,
                region: record.region,
                request_path: record.requestPath,
                request_params: JSON.stringify(record.requestParams || {}),
                response_code: record.responseCode,
                response_body: JSON.stringify(record.responseBody || {}),
                recovery_point: "completed",
                created_at: new Date(),
            })
            .onConflict(["key", "region"])
            .merge({
                response_code: record.responseCode,
                response_body: JSON.stringify(record.responseBody || {}),
                recovery_point: "completed",
            });
    } catch {
        // non-blocking if db write fails
    }
}
