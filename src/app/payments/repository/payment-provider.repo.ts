import type { Knex } from "knex";
import { PaymentProviderEntity } from "../entity/payment-provider.entity";

export async function findProviderByName(name: string, conn: Knex): Promise<PaymentProviderEntity | null> {
    const row = await conn("payment_providers").where({ name }).first();
    return row ? PaymentProviderEntity.toEntity(row) : null;
}

export async function findProviderById(id: number, conn: Knex): Promise<PaymentProviderEntity | null> {
    const row = await conn("payment_providers").where({ id }).first();
    return row ? PaymentProviderEntity.toEntity(row) : null;
}
