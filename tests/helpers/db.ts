import { db } from "../../src/lib/knex/knex";
import { env } from "../../src/lib/config/env";

export async function truncateShard(region: string): Promise<void> {
    const conn = db(region);
    const result = await conn.raw<{ rows: { tablename: string }[] }>(`
        SELECT c.relname AS tablename
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND NOT c.relispartition
          AND c.relname NOT IN ('knex_migrations', 'knex_migrations_lock');
    `);

    if (result.rows.length === 0) return;
    const tableNames = result.rows.map((r) => `"${r.tablename}"`).join(", ");
    await conn.raw(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
}

export async function truncateAll(): Promise<void> {
    await Promise.all(env.regions.map((region) => truncateShard(region)));
}
