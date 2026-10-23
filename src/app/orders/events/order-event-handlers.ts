import { registerHandler } from "../../../lib/core-events/consumer";
import { redisClient } from "../../../lib/cache/init";

import { logger } from "../../../lib/logger/logger";

export function registerOrderCoreEventHandlers(): void {
    // 1. product.stock.changed
    registerHandler("product.stock.changed", async (payload: any) => {
        logger.info("[event-handler] product.stock.changed", payload);
        const { branchId, productId } = payload || {};
        if (branchId && productId) {
            await redisClient.del(`core:product:price:${branchId}:${productId}`).catch(() => {});
            await redisClient.del(`core:product:stock:${branchId}:${productId}`).catch(() => {});
        }
        if (branchId) {
            const keys = await redisClient.keys(`restaurant:orders:${branchId}:*`).catch(() => []);
            if (keys.length > 0) await redisClient.del(...keys).catch(() => {});
        }
    });

    // 2. product.price.changed
    registerHandler("product.price.changed", async (payload: any) => {
        logger.info("[event-handler] product.price.changed", payload);
        const { branchId, productId } = payload || {};
        if (branchId && productId) {
            await redisClient.del(`core:product:price:${branchId}:${productId}`).catch(() => {});
        }
    });

    // 3. branch.updated
    registerHandler("branch.updated", async (payload: any) => {
        logger.info("[event-handler] branch.updated", payload);
        const { branchId } = payload || {};
        if (branchId) {
            await redisClient.del(`core:branch:${branchId}`).catch(() => {});
            await redisClient.del(`core:branch:deactivated:${branchId}`).catch(() => {});
        }
    });

    // 4. branch.deactivated
    registerHandler("branch.deactivated", async (payload: any) => {
        logger.info("[event-handler] branch.deactivated", payload);
        const { branchId } = payload || {};
        if (branchId) {
            await redisClient.del(`core:branch:${branchId}`).catch(() => {});
            await redisClient.set(`core:branch:deactivated:${branchId}`, "1", "EX", 86400).catch(() => {});
        }
    });

    // 5. restaurant.suspended
    registerHandler("restaurant.suspended", async (payload: any) => {
        logger.info("[event-handler] restaurant.suspended", payload);
        const { restaurantId } = payload || {};
        if (restaurantId) {
            await redisClient.del(`core:restaurant:${restaurantId}`).catch(() => {});
        }
    });
}
