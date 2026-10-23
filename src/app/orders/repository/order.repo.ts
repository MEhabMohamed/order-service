import { Knex } from "knex";
import { OrderEntity } from "../entity/order.entity";
import { OrderStatus, PaymentMethod } from "../enums";
import { decodeCursor, encodeCursor } from "../../../lib/http/pagination/cursor-pagination";

function toEntity(row: any): OrderEntity {
    return new OrderEntity({
        id: Number(row.id),
        region: row.region,
        publicId: row.public_id,
        countryCode: row.country_code,
        restaurantId: Number(row.restaurant_id),
        restaurantOwnerId: Number(row.restaurant_owner_id),
        branchId: Number(row.branch_id),
        customerId: Number(row.customer_id),
        customerAddressId: Number(row.customer_address_id),
        deliveryLat: Number(row.delivery_lat),
        deliveryLng: Number(row.delivery_lng),
        deliveryAddressTextSnapshot: row.delivery_address_text_snapshot,
        branchLat: Number(row.branch_lat),
        branchLng: Number(row.branch_lng),
        status: row.status as OrderStatus,
        subtotal: Number(row.subtotal),
        deliveryFee: Number(row.delivery_fee),
        serviceFee: Number(row.service_fee),
        total: Number(row.total),
        commission: Number(row.commission || 0),
        currency: row.currency,
        paymentMethod: row.payment_method as PaymentMethod,
        deliveryAgentId: row.delivery_agent_id ? Number(row.delivery_agent_id) : null,
        createdAt: row.created_at ? new Date(row.created_at) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
        acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
        rejectedAt: row.rejected_at ? new Date(row.rejected_at) : null,
        readyAt: row.ready_at ? new Date(row.ready_at) : null,
        assignedAt: row.assigned_at ? new Date(row.assigned_at) : null,
        pickedAt: row.picked_at ? new Date(row.picked_at) : null,
        deliveredAt: row.delivered_at ? new Date(row.delivered_at) : null,
        cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
    });
}

export async function createOrder(data: Partial<OrderEntity>, conn: Knex): Promise<OrderEntity> {
    const now = data.createdAt || new Date();
    const [row] = await conn("orders")
        .insert({
            region: data.region,
            public_id: data.publicId,
            country_code: data.countryCode,
            restaurant_id: data.restaurantId,
            restaurant_owner_id: data.restaurantOwnerId,
            branch_id: data.branchId,
            customer_id: data.customerId,
            customer_address_id: data.customerAddressId,
            delivery_lat: data.deliveryLat,
            delivery_lng: data.deliveryLng,
            delivery_address_text_snapshot: data.deliveryAddressTextSnapshot,
            branch_lat: data.branchLat,
            branch_lng: data.branchLng,
            status: data.status,
            subtotal: data.subtotal,
            delivery_fee: data.deliveryFee,
            service_fee: data.serviceFee,
            total: data.total,
            commission: data.commission ?? 0,
            currency: data.currency,
            payment_method: data.paymentMethod,
            delivery_agent_id: data.deliveryAgentId ?? null,
            created_at: now,
            updated_at: now,
        })
        .returning("*");

    return toEntity(row);
}

export async function findOrderByPublicId(publicId: string, conn: Knex): Promise<OrderEntity | null> {
    const row = await conn("orders")
        .where({ public_id: publicId })
        .first();

    return row ? toEntity(row) : null;
}

export async function findOrdersByCustomer(
    customerId: number,
    query: { cursor?: string; limit?: number; year?: number },
    conn: Knex
): Promise<{ orders: OrderEntity[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    let qb = conn("orders")
        .where({ customer_id: customerId })
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(limit + 1);

    if (query.year) {
        const start = new Date(`${query.year}-01-01T00:00:00.000Z`);
        const end = new Date(`${query.year + 1}-01-01T00:00:00.000Z`);
        qb = qb.where("created_at", ">=", start).where("created_at", "<", end);
    }


    if (query.cursor) {
        const decoded = decodeCursor(query.cursor);
        if (decoded && decoded.createdAt && decoded.id) {
            qb = qb.where((builder) => {
                builder
                    .where("created_at", "<", decoded.createdAt)
                    .orWhere((b2) => {
                        b2.where("created_at", "=", decoded.createdAt).andWhere("id", "<", decoded.id);
                    });
            });
        }
    }

    const rows = await qb;
    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    const orders = resultRows.map(toEntity);
    const lastItem = orders[orders.length - 1];
    const nextCursor = hasMore && lastItem && lastItem.createdAt && lastItem.id
        ? encodeCursor({ createdAt: lastItem.createdAt.toISOString(), id: lastItem.id })
        : null;

    return { orders, nextCursor, hasMore };
}

export async function findOrdersByBranch(
    branchId: number,
    query: { status?: OrderStatus; from?: string; to?: string; cursor?: string; limit?: number },
    conn: Knex
): Promise<{ orders: OrderEntity[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    let qb = conn("orders")
        .where({ branch_id: branchId })
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(limit + 1);

    if (query.status) {
        qb = qb.where({ status: query.status });
    }
    if (query.from) {
        qb = qb.where("created_at", ">=", new Date(query.from));
    }
    if (query.to) {
        qb = qb.where("created_at", "<=", new Date(query.to));
    }

    if (query.cursor) {
        const decoded = decodeCursor(query.cursor);
        if (decoded && decoded.createdAt && decoded.id) {
            qb = qb.where((builder) => {
                builder
                    .where("created_at", "<", decoded.createdAt)
                    .orWhere((b2) => {
                        b2.where("created_at", "=", decoded.createdAt).andWhere("id", "<", decoded.id);
                    });
            });
        }
    }

    const rows = await qb;
    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    const orders = resultRows.map(toEntity);
    const lastItem = orders[orders.length - 1];
    const nextCursor = hasMore && lastItem && lastItem.createdAt && lastItem.id
        ? encodeCursor({ createdAt: lastItem.createdAt.toISOString(), id: lastItem.id })
        : null;

    return { orders, nextCursor, hasMore };
}

export async function updateOrderStatus(
    publicId: string,
    status: OrderStatus,
    timestamps: Partial<OrderEntity>,
    conn: Knex
): Promise<OrderEntity | null> {
    const updatePayload: Record<string, any> = {
        status,
        updated_at: new Date(),
    };

    if (timestamps.acceptedAt) updatePayload.accepted_at = timestamps.acceptedAt;
    if (timestamps.rejectedAt) updatePayload.rejected_at = timestamps.rejectedAt;
    if (timestamps.readyAt) updatePayload.ready_at = timestamps.readyAt;
    if (timestamps.assignedAt) updatePayload.assigned_at = timestamps.assignedAt;
    if (timestamps.pickedAt) updatePayload.picked_at = timestamps.pickedAt;
    if (timestamps.deliveredAt) updatePayload.delivered_at = timestamps.deliveredAt;
    if (timestamps.cancelledAt) updatePayload.cancelled_at = timestamps.cancelledAt;

    const [row] = await conn("orders")
        .where({ public_id: publicId })
        .update(updatePayload)
        .returning("*");

    return row ? toEntity(row) : null;
}

export async function setDeliveryAgent(publicId: string, agentId: number, conn: Knex): Promise<void> {
    await conn("orders")
        .where({ public_id: publicId })
        .update({
            delivery_agent_id: agentId,
            assigned_at: new Date(),
            updated_at: new Date(),
        });
}
