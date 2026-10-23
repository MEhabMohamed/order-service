import { Knex } from "knex";
import { OrderItemEntity } from "../entity/order-item.entity";

function toEntity(row: any): OrderItemEntity {
    return new OrderItemEntity({
        id: Number(row.id),
        region: row.region,
        orderId: Number(row.order_id),
        orderCreatedAt: new Date(row.order_created_at),
        productId: Number(row.product_id),
        quantity: Number(row.quantity),
        unitPriceSnapshot: Number(row.unit_price_snapshot),
        nameSnapshot: row.name_snapshot,
        imageUrlSnapshot: row.image_url_snapshot,
        lineTotal: Number(row.line_total),
        createdAt: row.created_at ? new Date(row.created_at) : undefined,
    });
}

export async function bulkInsertItems(
    items: Partial<OrderItemEntity>[],
    conn: Knex
): Promise<OrderItemEntity[]> {
    if (!items.length) return [];

    const rows = items.map((item) => ({
        region: item.region,
        order_id: item.orderId,
        order_created_at: item.orderCreatedAt || new Date(),
        product_id: item.productId,
        quantity: item.quantity,
        unit_price_snapshot: item.unitPriceSnapshot,
        name_snapshot: item.nameSnapshot,
        image_url_snapshot: item.imageUrlSnapshot ?? null,
        line_total: item.lineTotal,
        created_at: item.createdAt || new Date(),
    }));

    const result = await conn("order_items")
        .insert(rows)
        .returning("*");

    return result.map(toEntity);
}

export async function findItemsByOrderIds(
    orderIds: number[],
    conn: Knex
): Promise<OrderItemEntity[]> {
    if (!orderIds.length) return [];

    const rows = await conn("order_items")
        .whereIn("order_id", orderIds)
        .orderBy("id", "asc");

    return rows.map(toEntity);
}
