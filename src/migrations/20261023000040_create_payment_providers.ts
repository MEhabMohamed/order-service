import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS payment_providers (
            id          INT PRIMARY KEY,
            name        TEXT NOT NULL UNIQUE,
            is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
            priority    SMALLINT NOT NULL DEFAULT 100
        );
    `);

    // Only seed Kashier in Egyptian (eg) shards; Kashier is not available in KSA.
    // COD (Cash on Delivery) is a payment method, not a payment provider.
    const result = await knex.raw("SELECT current_database() as db");
    const dbName: string = result.rows[0]?.db || "";

    if (dbName.toLowerCase().endsWith("_eg") || dbName.toLowerCase().includes("_eg")) {
        await knex.raw(`
            INSERT INTO payment_providers (id, name, is_enabled, priority)
            VALUES (1, 'kashier', true, 10)
            ON CONFLICT (id) DO NOTHING;
        `);
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw(`
        DROP TABLE IF EXISTS payment_providers CASCADE;
    `);
}

