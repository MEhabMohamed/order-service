import type { Knex } from "knex";
import { RecordWebhookEventInput } from "../types";

export async function tryRecordWebhookEvent(
    input: RecordWebhookEventInput,
    conn: Knex
): Promise<boolean> {
    const rawSql = `
        INSERT INTO payment_webhook_events (
            region, provider_id, provider_event_id, signature, payload, received_at
        ) VALUES (
            ?, ?, ?, ?, ?::jsonb, NOW()
        )
        ON CONFLICT (provider_id, provider_event_id) DO NOTHING
        RETURNING id;
    `;

    const result = await conn.raw(rawSql, [
        input.region,
        input.providerId,
        input.providerEventId,
        input.signature,
        JSON.stringify(input.payload),
    ]);

    const rows = result.rows || [];
    return rows.length > 0;
}

export async function markWebhookEventProcessed(
    providerId: number,
    providerEventId: string,
    conn: Knex,
    processError?: string
): Promise<void> {
    await conn("payment_webhook_events")
        .where({
            provider_id: providerId,
            provider_event_id: providerEventId,
        })
        .update({
            processed_at: new Date(),
            process_error: processError || null,
        });
}
