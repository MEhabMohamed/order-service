import { inject, injectable } from "tsyringe";
import type Redis from "ioredis";
import { TOKENS } from "../../../lib/di/tokens";
import { ICacheProvider } from "../../../pkg/cache/cache.interface";
import { Logger } from "../../../lib/logger/logger";
import { registerHandler } from "../../../lib/core-events/consumer";
import { container } from "../../../lib/di/container";
import {
    BranchDeactivatedPayload,
    BranchUpdatedPayload,
    ProductPriceChangedPayload,
    ProductStockChangedPayload,
    RestaurantSuspendedPayload,
} from "./types";

@injectable()

export class OrderCoreEventsHandler {
    constructor(
        @inject(TOKENS.CacheProvider)
        private readonly cache: ICacheProvider,
        @inject(TOKENS.RedisClient)
        private readonly redis: Redis,
        @inject(TOKENS.Logger)
        private readonly logger: Logger
    ) {}

    handleProductStockChanged = async (payload: ProductStockChangedPayload): Promise<void> => {
        this.logger.info("[event-handler] product.stock.changed", payload as Record<string, unknown>);
        const { branchId, productId } = payload || {};
        if (branchId && productId) {
            await this.cache.del(`core:product:price:${branchId}:${productId}`).catch(() => {});
            await this.cache.del(`core:product:stock:${branchId}:${productId}`).catch(() => {});
        }
        if (branchId) {
            const keys = await this.redis.keys(`restaurant:orders:${branchId}:*`).catch(() => []);
            if (keys.length > 0) {
                await this.redis.del(...keys).catch(() => {});
            }
        }
    };

    handleProductPriceChanged = async (payload: ProductPriceChangedPayload): Promise<void> => {
        this.logger.info("[event-handler] product.price.changed", payload as Record<string, unknown>);
        const { branchId, productId } = payload || {};
        if (branchId && productId) {
            await this.cache.del(`core:product:price:${branchId}:${productId}`).catch(() => {});
        }
    };

    handleBranchUpdated = async (payload: BranchUpdatedPayload): Promise<void> => {
        this.logger.info("[event-handler] branch.updated", payload as Record<string, unknown>);
        const { branchId } = payload || {};
        if (branchId) {
            await this.cache.del(`core:branch:${branchId}`).catch(() => {});
            await this.cache.del(`core:branch:deactivated:${branchId}`).catch(() => {});
        }
    };

    handleBranchDeactivated = async (payload: BranchDeactivatedPayload): Promise<void> => {
        this.logger.info("[event-handler] branch.deactivated", payload as Record<string, unknown>);
        const { branchId } = payload || {};
        if (branchId) {
            await this.cache.del(`core:branch:${branchId}`).catch(() => {});
            await this.cache.set(`core:branch:deactivated:${branchId}`, "1", 86400).catch(() => {});
        }
    };

    handleRestaurantSuspended = async (payload: RestaurantSuspendedPayload): Promise<void> => {
        this.logger.info("[event-handler] restaurant.suspended", payload as Record<string, unknown>);
        const { restaurantId } = payload || {};
        if (restaurantId) {
            await this.cache.del(`core:restaurant:${restaurantId}`).catch(() => {});
        }
    };

    register(): void {
        registerHandler("product.stock.changed", this.handleProductStockChanged);
        registerHandler("product.price.changed", this.handleProductPriceChanged);
        registerHandler("branch.updated", this.handleBranchUpdated);
        registerHandler("branch.deactivated", this.handleBranchDeactivated);
        registerHandler("restaurant.suspended", this.handleRestaurantSuspended);
    }
}

export function registerOrderCoreEventHandlers(): void {
    const handler = container.resolve<OrderCoreEventsHandler>(TOKENS.OrderCoreEventsHandler);
    handler.register();
}
