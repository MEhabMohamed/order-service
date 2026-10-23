import type { Knex } from "knex";
import { TransactionEntity } from "../entity/transaction.entity";
import { TransactionStatus, TransactionType } from "../enums";
import { CreateTransactionInput } from "../types";

export async function createTransaction(
    input: CreateTransactionInput,
    conn: Knex
): Promise<TransactionEntity> {
    const [row] = await conn("transactions")
        .insert({
            region: input.region,
            order_id: input.orderId || null,
            order_created_at: input.orderCreatedAt || null,
            transaction_type: input.transactionType,
            method: input.method,
            provider_id: input.providerId || null,
            provider_reference_id: input.providerReferenceId || null,
            status: input.status,
            amount: input.amount,
            currency: input.currency,
            src_acc_id: input.srcAccId ?? null,
            dst_acc_id: input.dstAccId ?? null,
            is_refunded: input.isRefunded || false,
            refunded_payment_id: input.refundedPaymentId || null,
            idempotency_key: input.idempotencyKey || null,
            created_at: new Date(),
            updated_at: new Date(),
        })
        .returning("*");

    return TransactionEntity.toEntity(row);
}

export async function findTransactionById(
    id: number,
    conn: Knex
): Promise<TransactionEntity | null> {
    const row = await conn("transactions").where({ id }).first();
    return row ? TransactionEntity.toEntity(row) : null;
}

export async function findTransactionsByOrderId(
    orderId: number,
    conn: Knex
): Promise<TransactionEntity[]> {
    const rows = await conn("transactions")
        .where({ order_id: orderId })
        .orderBy("created_at", "asc");

    return rows.map((r) => TransactionEntity.toEntity(r));
}

export async function findTransactionByProviderReference(
    providerReferenceId: string,
    conn: Knex
): Promise<TransactionEntity | null> {
    const row = await conn("transactions")
        .where({ provider_reference_id: providerReferenceId })
        .first();

    return row ? TransactionEntity.toEntity(row) : null;
}

export async function updateTransactionStatus(
    id: number,
    status: TransactionStatus,
    conn: Knex,
    extraUpdates?: {
        isRefunded?: boolean;
        refundedPaymentId?: number | null;
        providerReferenceId?: string;
    }
): Promise<void> {
    const updateData: any = {
        status,
        updated_at: new Date(),
    };

    if (extraUpdates?.isRefunded !== undefined) {
        updateData.is_refunded = extraUpdates.isRefunded;
    }
    if (extraUpdates?.refundedPaymentId !== undefined) {
        updateData.refunded_payment_id = extraUpdates.refundedPaymentId;
    }
    if (extraUpdates?.providerReferenceId !== undefined) {
        updateData.provider_reference_id = extraUpdates.providerReferenceId;
    }

    await conn("transactions").where({ id }).update(updateData);
}

export async function sumRefundsForPayment(
    paymentId: number,
    conn: Knex
): Promise<number> {
    const result = await conn("transactions")
        .where({
            refunded_payment_id: paymentId,
            transaction_type: TransactionType.REFUND,
        })
        .whereIn("status", [TransactionStatus.PENDING, TransactionStatus.SUCCEEDED])
        .sum("amount as total")
        .first();

    return Number(result?.total || 0);
}
