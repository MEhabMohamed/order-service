import { v4 as uuidv4 } from "uuid";
import { injectable } from "tsyringe";
import { db } from "../../../lib/knex/knex";
import { redisClient } from "../../../lib/cache/init";

import { branchClient } from "../../../lib/core-client/branch.client";
import { addressClient } from "../../../lib/core-client/address.client";
import { CreateOrderRequestDTO } from "../dto/create-order.dto";
import { OrderDetailResponseDTO, OrderItemResponseDTO, OrderResponseDTO, OrderStatusResponseDTO, OrderSummaryResponseDTO } from "../dto/order-response.dto";
import { OrderEntity } from "../entity/order.entity";
import { OrderItemEntity } from "../entity/order-item.entity";
import { OrderStatus, PaymentMethod } from "../enums";
import { BranchNotAcceptingOrdersError, OrderNotFoundError, OutOfStockError, UnauthorizedOrderAccessError } from "../errors";
import { createOrder, findOrderByPublicId, findOrdersByBranch, findOrdersByCustomer, updateOrderStatus } from "../repository/order.repo";
import { bulkInsertItems, findItemsByOrderIds } from "../repository/order-item.repo";
import { orderStatusService } from "./order-status.service";
import { container } from "../../../lib/di/container";
import { TOKENS } from "../../../lib/di/tokens";

@injectable()
export class OrderService {
    async placeOrder(
        customerId: number,
        region: string,
        data: CreateOrderRequestDTO,
        idempotencyKey?: string
    ): Promise<OrderResponseDTO> {
        // 1. Fetch branch metadata and validate
        const branch = await branchClient.getBranch(data.branchId);
        if (!branch) {
            throw new BranchNotAcceptingOrdersError("BranchNotFound");
        }

        const isDeactivatedInRedis = await redisClient.get(`core:branch:deactivated:${branch.id}`);
        if (isDeactivatedInRedis || !branch.isActive || !branch.acceptOrders || branch.restaurantStatus !== "active") {
            throw new BranchNotAcceptingOrdersError("BranchNotAcceptingOrders");
        }

        const targetRegion = branch.region ? branch.region.toLowerCase() : region.toLowerCase();

        // 2. Fetch customer address snapshot
        const address = await addressClient.getCustomerAddress(data.customerAddressId);
        if (!address) {
            throw new BranchNotAcceptingOrdersError("Customer address not found");
        }

        // 3. Batch fetch product prices & stock
        const productIds = data.items.map((i) => i.productId);
        const branchProducts = await branchClient.getBranchProducts(data.branchId, productIds);
        const productMap = new Map(branchProducts.map((p) => [p.productId, p]));

        const outOfStockDetails: Array<{ productId: number; requested: number; available: number }> = [];
        for (const item of data.items) {
            const bp = productMap.get(item.productId);
            if (!bp || !bp.isAvailable || bp.stock < item.quantity) {
                outOfStockDetails.push({
                    productId: item.productId,
                    requested: item.quantity,
                    available: bp ? bp.stock : 0,
                });
            }
        }

        if (outOfStockDetails.length > 0) {
            throw new OutOfStockError(outOfStockDetails);
        }

        // 4. Compute money
        let subtotal = 0;
        const itemSnapshots = data.items.map((item) => {
            const bp = productMap.get(item.productId)!;
            const lineTotal = bp.price * item.quantity;
            subtotal += lineTotal;
            return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: bp.price,
                lineTotal,
                name: bp.name,
                imageUrl: bp.imageUrl || undefined,
            };
        });

        const deliveryFee = branch.deliveryFee || 0;
        const serviceFee = 0;
        const total = subtotal + deliveryFee + serviceFee;
        const publicId = uuidv4();
        const initialStatus = data.paymentMethod === PaymentMethod.ONLINE ? OrderStatus.PENDING_PAYMENT : OrderStatus.PLACED;
        const now = new Date();

        // 5. In one transaction on the branch's region DB
        const conn = db(targetRegion);
        let createdOrder: OrderEntity;
        let createdItems: OrderItemEntity[];

        await conn.transaction(async (trx) => {
            createdOrder = await createOrder(
                {
                    region: targetRegion,
                    publicId,
                    countryCode: branch.region.toUpperCase(),
                    restaurantId: branch.restaurantId,
                    branchId: branch.id,
                    customerId,
                    customerAddressId: address.id,
                    deliveryLat: address.lat,
                    deliveryLng: address.lng,
                    deliveryAddressTextSnapshot: address.addressText,
                    status: initialStatus,
                    subtotal,
                    deliveryFee,
                    serviceFee,
                    total,
                    commission: Math.round((subtotal * branch.commissionBps) / 10000),
                    currency: branch.currency || "EGP",
                    paymentMethod: data.paymentMethod,
                    createdAt: now,
                    updatedAt: now,
                },
                trx
            );

            const itemsToInsert = itemSnapshots.map((item) => ({
                region: targetRegion,
                orderId: createdOrder.id!,
                orderCreatedAt: createdOrder.createdAt || now,
                productId: item.productId,
                quantity: item.quantity,
                unitPriceSnapshot: item.unitPrice,
                nameSnapshot: item.name,
                imageUrlSnapshot: item.imageUrl,
                lineTotal: item.lineTotal,
                createdAt: now,
            }));

            createdItems = await bulkInsertItems(itemsToInsert, trx);
        });

        // 6. After-commit: reserve stock on core-service
        try {
            await branchClient.reserveStock(data.branchId, data.items, idempotencyKey);
        } catch (err) {
            // Reserve stock failed post-commit -> void order
            await updateOrderStatus(publicId, OrderStatus.CANCELLED, { cancelledAt: new Date() }, conn);
            throw new OutOfStockError(
                data.items.map((i) => ({ productId: i.productId, requested: i.quantity, available: 0 }))
            );
        }

        // Invalidate branch order list cache
        const keys = await redisClient.keys(`restaurant:orders:${branch.id}:*`).catch(() => []);
        if (keys.length > 0) {
            await redisClient.del(...keys).catch(() => {});
        }

        // 7. Emit WS event if socket server available
        if (initialStatus === OrderStatus.PLACED) {
            this.emitWs(`branch:${branch.id}`, "order.created", {
                publicId: createdOrder!.publicId,
                status: createdOrder!.status,
                total: createdOrder!.total,
                currency: createdOrder!.currency,
                itemsCount: createdItems!.length,
                restaurant: { id: branch.restaurantId, name: branch.name },
                branchId: branch.id,
                createdAt: createdOrder!.createdAt!.toISOString(),
            });
        }

        return {
            publicId: createdOrder!.publicId,
            status: createdOrder!.status,
            paymentMethod: createdOrder!.paymentMethod,
            branch: { id: branch.id, name: branch.name },
            restaurant: { id: branch.restaurantId, name: branch.name },
            customerAddress: {
                lat: address.lat,
                lng: address.lng,
                addressText: address.addressText,
            },
            subtotal: createdOrder!.subtotal,
            deliveryFee: createdOrder!.deliveryFee,
            serviceFee: createdOrder!.serviceFee,
            total: createdOrder!.total,
            currency: createdOrder!.currency,
            items: itemSnapshots,
            createdAt: createdOrder!.createdAt!.toISOString(),
        };
    }

    async getOrder(
        publicId: string,
        region: string,
        user: { userId: number; role?: string }
    ): Promise<OrderDetailResponseDTO> {
        const conn = db(region);
        const order = await findOrderByPublicId(publicId, conn);
        if (!order) {
            throw new OrderNotFoundError();
        }

        const isCustomer = Number(order.customerId) === Number(user.userId);
        const isAdmin = user.role === "system_admin";
        const isRestaurantUser = user.role === "restaurant_user";

        if (!isCustomer && !isAdmin && !isRestaurantUser) {
            throw new UnauthorizedOrderAccessError();
        }

        const items = await findItemsByOrderIds([order.id!], conn);
        const branch = await branchClient.getBranch(order.branchId).catch(() => null);

        const history: Array<{ status: OrderStatus; ts: string }> = [
            { status: OrderStatus.PLACED, ts: order.createdAt!.toISOString() },
        ];
        if (order.acceptedAt) history.push({ status: OrderStatus.ACCEPTED, ts: order.acceptedAt.toISOString() });
        if (order.readyAt) history.push({ status: OrderStatus.READY, ts: order.readyAt.toISOString() });
        if (order.assignedAt) history.push({ status: OrderStatus.ASSIGNED, ts: order.assignedAt.toISOString() });
        if (order.pickedAt) history.push({ status: OrderStatus.PICKED, ts: order.pickedAt.toISOString() });
        if (order.deliveredAt) history.push({ status: OrderStatus.DELIVERED, ts: order.deliveredAt.toISOString() });
        if (order.rejectedAt) history.push({ status: OrderStatus.REJECTED, ts: order.rejectedAt.toISOString() });
        if (order.cancelledAt) history.push({ status: OrderStatus.CANCELLED, ts: order.cancelledAt.toISOString() });

        const itemDtos: OrderItemResponseDTO[] = items.map((i) => ({
            productId: i.productId,
            name: i.nameSnapshot,
            imageUrl: i.imageUrlSnapshot || undefined,
            quantity: i.quantity,
            unitPrice: i.unitPriceSnapshot,
            lineTotal: i.lineTotal,
        }));

        return {
            publicId: order.publicId,
            status: order.status,
            paymentMethod: order.paymentMethod,
            branch: { id: order.branchId, name: branch ? branch.name : `Branch ${order.branchId}` },
            restaurant: { id: order.restaurantId, name: branch ? branch.name : `Restaurant ${order.restaurantId}` },
            customerAddress: {
                lat: order.deliveryLat,
                lng: order.deliveryLng,
                addressText: order.deliveryAddressTextSnapshot,
            },
            subtotal: order.subtotal,
            deliveryFee: order.deliveryFee,
            serviceFee: order.serviceFee,
            total: order.total,
            currency: order.currency,
            items: itemDtos,
            createdAt: order.createdAt!.toISOString(),
            paymentSummary: {
                method: order.paymentMethod,
                status: order.status === OrderStatus.DELIVERED ? "captured" : "pending",
                amount: order.total,
                currency: order.currency,
                refundedAmount: 0,
            },
            history,
        };
    }

    async listCustomerOrders(
        customerId: number,
        region: string,
        query: { cursor?: string; limit?: number; year?: number }
    ): Promise<{ orders: OrderSummaryResponseDTO[]; nextCursor: string | null; hasMore: boolean }> {

        const conn = db(region);
        const { orders, nextCursor, hasMore } = await findOrdersByCustomer(customerId, query, conn);

        const summaryDtos: OrderSummaryResponseDTO[] = await Promise.all(
            orders.map(async (o) => {
                const branch = await branchClient.getBranch(o.branchId).catch(() => null);
                return {
                    publicId: o.publicId,
                    status: o.status,
                    total: o.total,
                    currency: o.currency,
                    itemsCount: 0,
                    restaurant: { id: o.restaurantId, name: branch ? branch.name : `Restaurant ${o.restaurantId}` },
                    branchId: o.branchId,
                    createdAt: o.createdAt!.toISOString(),
                };
            })
        );

        return { orders: summaryDtos, nextCursor, hasMore };
    }

    async listRestaurantOrders(
        branchId: number,
        region: string,
        query: { status?: OrderStatus; from?: string; to?: string; cursor?: string; limit?: number }
    ): Promise<{ orders: OrderSummaryResponseDTO[]; nextCursor: string | null; hasMore: boolean }> {
        const conn = db(region);
        const { orders, nextCursor, hasMore } = await findOrdersByBranch(branchId, query, conn);
        const branch = await branchClient.getBranch(branchId).catch(() => null);

        const summaryDtos: OrderSummaryResponseDTO[] = orders.map((o) => ({
            publicId: o.publicId,
            status: o.status,
            total: o.total,
            currency: o.currency,
            itemsCount: 0,
            restaurant: { id: o.restaurantId, name: branch ? branch.name : `Restaurant ${o.restaurantId}` },
            branchId: o.branchId,
            createdAt: o.createdAt!.toISOString(),
        }));

        return { orders: summaryDtos, nextCursor, hasMore };
    }

    async updateStatus(
        publicId: string,
        region: string,
        newStatus: OrderStatus,
        reason?: string,
        user?: { userId: number; role?: string }
    ): Promise<OrderStatusResponseDTO> {
        const conn = db(region);
        const order = await findOrderByPublicId(publicId, conn);
        if (!order) {
            throw new OrderNotFoundError();
        }

        const isCustomer = user ? Number(order.customerId) === Number(user.userId) : false;
        const isAdmin = user ? user.role === "system_admin" : true;
        const isRestaurantMember = user ? user.role === "restaurant_user" || user.role === "owner" : true;

        orderStatusService.assertTransition(
            order.status,
            newStatus,
            {
                userId: user?.userId ?? 0,
                systemRole: user?.role ?? "",
                isCustomer,
                isRestaurantMember,
                isAdmin,
            },
            order.createdAt,
            order.acceptedAt
        );

        const timestamps: Partial<OrderEntity> = {};
        const now = new Date();
        switch (newStatus) {
            case OrderStatus.ACCEPTED:
                timestamps.acceptedAt = now;
                break;
            case OrderStatus.REJECTED:
                timestamps.rejectedAt = now;
                break;
            case OrderStatus.READY:
                timestamps.readyAt = now;
                break;
            case OrderStatus.ASSIGNED:
                timestamps.assignedAt = now;
                break;
            case OrderStatus.PICKED:
                timestamps.pickedAt = now;
                break;
            case OrderStatus.DELIVERED:
                timestamps.deliveredAt = now;
                break;
            case OrderStatus.CANCELLED:
                timestamps.cancelledAt = now;
                break;
        }

        const updated = await updateOrderStatus(publicId, newStatus, timestamps, conn);
        if (!updated) {
            throw new OrderNotFoundError();
        }

        // Invalidate branch orders cache
        const keys = await redisClient.keys(`restaurant:orders:${order.branchId}:*`).catch(() => []);
        if (keys.length > 0) {
            await redisClient.del(...keys).catch(() => {});
        }

        // Emit WS events
        this.emitWs(`customer:${order.customerId}`, "order.status_changed", {
            orderId: order.publicId,
            status: newStatus,
            ts: now.toISOString(),
        });
        this.emitWs(`branch:${order.branchId}`, "order.status_changed", {
            orderId: order.publicId,
            status: newStatus,
            ts: now.toISOString(),
        });

        if (newStatus === OrderStatus.CANCELLED) {
            this.emitWs(`customer:${order.customerId}`, "order.cancelled", {
                orderId: order.publicId,
                reason,
                ts: now.toISOString(),
            });
            this.emitWs(`branch:${order.branchId}`, "order.cancelled", {
                orderId: order.publicId,
                reason,
                ts: now.toISOString(),
            });
        }

        return {
            publicId: updated.publicId,
            status: updated.status,
            updatedAt: updated.updatedAt ? updated.updatedAt.toISOString() : now.toISOString(),
        };
    }

    private emitWs(room: string, event: string, payload: any): void {
        try {
            const io = container.resolve<any>(TOKENS.WsServer);
            if (io && typeof io.to === "function") {
                io.to(room).emit(event, payload);
            }
        } catch {
            // WS emission non-blocking
        }
    }
}
