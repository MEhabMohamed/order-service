import { Knex } from "knex";
import { RestaurantBalanceEntity } from "../entity/restaurant-balance.entity";

function toEntity(row: any): RestaurantBalanceEntity {
    return new RestaurantBalanceEntity({
        restaurantId: Number(row.restaurant_id),
        region: row.region,
        currency: row.currency,
        balance: Number(row.balance),
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    });
}

export async function findBalance(
    restaurantId: number,
    currency: string,
    conn: Knex
): Promise<RestaurantBalanceEntity | null> {
    const row = await conn("restaurant_balances")
        .where({ restaurant_id: restaurantId, currency })
        .first();

    return row ? toEntity(row) : null;
}

export async function findBalanceForUpdate(
    restaurantId: number,
    currency: string,
    conn: Knex
): Promise<RestaurantBalanceEntity | null> {
    const row = await conn("restaurant_balances")
        .where({ restaurant_id: restaurantId, currency })
        .forUpdate()
        .first();

    return row ? toEntity(row) : null;
}

export async function upsertBalance(
    restaurantId: number,
    region: string,
    currency: string,
    deltaAmount: number,
    conn: Knex
): Promise<RestaurantBalanceEntity> {
    const now = new Date();
    const query = `
        INSERT INTO restaurant_balances (restaurant_id, region, currency, balance, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (restaurant_id, currency)
        DO UPDATE SET
            balance = restaurant_balances.balance + EXCLUDED.balance,
            updated_at = EXCLUDED.updated_at
        RETURNING *;
    `;

    const result = await conn.raw(query, [restaurantId, region, currency, deltaAmount, now]);
    const row = result.rows[0];
    return toEntity(row);
}

export async function findAllBalances(
    restaurantId: number,
    conn: Knex
): Promise<RestaurantBalanceEntity[]> {
    const rows = await conn("restaurant_balances")
        .where({ restaurant_id: restaurantId });

    return rows.map(toEntity);
}
