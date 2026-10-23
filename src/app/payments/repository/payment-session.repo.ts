import type { Knex } from "knex";
import { PaymentSessionEntity } from "../entity/payment-session.entity";
import { PaymentSessionStatus } from "../enums";
import { CreatePaymentSessionInput } from "../types";

export async function createPaymentSession(
    input: CreatePaymentSessionInput,
    conn: Knex
): Promise<PaymentSessionEntity> {
    const [row] = await conn("payment_sessions")
        .insert({
            region: input.region,
            order_id: input.orderId,
            order_created_at: input.orderCreatedAt,
            provider_id: input.providerId,
            provider_session_id: input.providerSessionId,
            redirect_url: input.redirectUrl,
            amount: input.amount,
            currency: input.currency,
            status: input.status,
            raw_init_payload: JSON.stringify(input.rawInitPayload),
            created_at: new Date(),
            updated_at: new Date(),
        })
        .returning("*");

    return PaymentSessionEntity.toEntity(row);
}

export async function findSessionById(id: number, conn: Knex): Promise<PaymentSessionEntity | null> {
    const row = await conn("payment_sessions").where({ id }).first();
    return row ? PaymentSessionEntity.toEntity(row) : null;
}

export async function findSessionByProviderSessionId(
    providerSessionId: string,
    conn: Knex
): Promise<PaymentSessionEntity | null> {
    const row = await conn("payment_sessions").where({ provider_session_id: providerSessionId }).first();
    return row ? PaymentSessionEntity.toEntity(row) : null;
}

export async function findActiveSessionByOrderId(
    orderId: number,
    conn: Knex
): Promise<PaymentSessionEntity | null> {
    const row = await conn("payment_sessions")
        .where({ order_id: orderId })
        .whereIn("status", [PaymentSessionStatus.INITIALIZED, PaymentSessionStatus.PENDING])
        .orderBy("created_at", "desc")
        .first();

    return row ? PaymentSessionEntity.toEntity(row) : null;
}

export async function updatePaymentSessionStatus(
    id: number,
    status: PaymentSessionStatus,
    rawLastPayload: any,
    conn: Knex
): Promise<void> {
    await conn("payment_sessions")
        .where({ id })
        .update({
            status,
            raw_last_payload: rawLastPayload ? JSON.stringify(rawLastPayload) : null,
            updated_at: new Date(),
        });
}
