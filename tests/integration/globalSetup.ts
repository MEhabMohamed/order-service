import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../../.env.test"), override: true });

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

async function ensureOrderPartitions(conn: any, monthsAhead = 3): Promise<void> {
    const existing = await conn.raw(`
        SELECT pg_get_expr(c.relpartbound, c.oid) AS bound
        FROM pg_inherits i
        JOIN pg_class c ON c.oid = i.inhrelid
        WHERE i.inhparent = 'public.orders'::regclass
    `);
    const bounds: string[] = (existing.rows ?? []).map((r: { bound: string }) => r.bound ?? "");

    const now = new Date();
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    for (let i = 0; i < monthsAhead; i++) {
        const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
        const name = `orders_${cursor.getUTCFullYear()}_${pad(cursor.getUTCMonth() + 1)}`;
        const fromIso = `${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}-01`;
        const toIso = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-01`;

        const alreadyCovered = bounds.some((b) => b.includes(fromIso));
        if (!alreadyCovered) {
            await conn.raw(
                `CREATE TABLE IF NOT EXISTS ${name} PARTITION OF orders FOR VALUES FROM ('${fromIso}') TO ('${toIso}')`
            );
        }
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
}

export default async function globalSetup() {
    const { env } = require("../../src/lib/config/env");
    const { db } = require("../../src/lib/knex/knex");

    for (const region of env.regions) {
        const conn = db(region);
        await conn.migrate.latest();
        await ensureOrderPartitions(conn);
    }
}
