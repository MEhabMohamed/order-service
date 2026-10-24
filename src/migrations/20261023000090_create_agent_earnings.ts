import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS agent_earnings (
            id                  BIGSERIAL PRIMARY KEY,
            region              TEXT NOT NULL,
            agent_id            BIGINT NOT NULL,
            order_id            BIGINT NOT NULL,
            order_created_at    TIMESTAMP NOT NULL,
            amount              INT NOT NULL,
            currency            TEXT NOT NULL,
            earned_at           TIMESTAMP NOT NULL DEFAULT NOW(),

            CONSTRAINT fk_agent_earnings_order FOREIGN KEY (order_id, order_created_at) REFERENCES orders(id, created_at) ON DELETE CASCADE,
            CONSTRAINT uq_agent_earnings_order_id UNIQUE (order_id)
        );

        -- supports GET /agents/earnings?from=&to=
        CREATE INDEX IF NOT EXISTS idx_agent_earnings_agent_earned_at ON agent_earnings (agent_id, earned_at DESC);
    `);
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw(`
        DROP TABLE IF EXISTS agent_earnings CASCADE;
    `);
}
