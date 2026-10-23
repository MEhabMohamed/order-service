import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.raw(`
        CREATE TABLE idempotency_keys (
            key             TEXT NOT NULL,
            region          TEXT NOT NULL,
            request_path    TEXT NOT NULL,
            request_params  JSONB NOT NULL,
            response_code   INT NULL,
            response_body   JSONB NULL,
            recovery_point  TEXT NOT NULL DEFAULT 'started',
            locked_at       TIMESTAMP NULL,
            created_at      TIMESTAMP NOT NULL DEFAULT NOW(),

            PRIMARY KEY (key, region)
        );

        CREATE INDEX idx_idempotency_keys_created_at ON idempotency_keys (created_at);
    `);
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw(`
        DROP TABLE IF EXISTS idempotency_keys CASCADE;
    `);
}
