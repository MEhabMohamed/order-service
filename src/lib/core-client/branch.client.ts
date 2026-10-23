import { coreClient } from "./core-client";
import { redisClient } from "../cache/init";
import { BranchMetadata, BranchProduct } from "./types";

export type { BranchMetadata, BranchProduct };

export class BranchClient {

    async getBranch(branchId: number): Promise<BranchMetadata> {
        const cacheKey = `core:branch:${branchId}`;
        const cached = await redisClient.get(cacheKey).catch(() => null);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch {
                // ignore cache parse error
            }
        }

        const res = await coreClient.request<{ success: boolean; data: BranchMetadata }>({
            method: "GET",
            path: `/api/internal/branches/${branchId}`,
        });

        const data = res.data;
        if (data) {
            await redisClient.set(cacheKey, JSON.stringify(data), "EX", 300).catch(() => {});
        }
        return data;
    }

    async getBranchProducts(branchId: number, productIds: number[]): Promise<BranchProduct[]> {
        const res = await coreClient.request<{ success: boolean; data: BranchProduct[] }>({
            method: "GET",
            path: `/api/internal/branches/${branchId}/products?ids=${productIds.join(",")}`,
        });
        return res.data;
    }

    async reserveStock(
        branchId: number,
        items: { productId: number; quantity: number }[],
        idempotencyKey?: string
    ): Promise<void> {
        await coreClient.request<void>({
            method: "POST",
            path: `/api/internal/branches/${branchId}/reserve-stock`,
            body: { items },
            idempotencyKey,
        });
    }
}

export const branchClient = new BranchClient();
