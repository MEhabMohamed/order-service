export interface ProductStockChangedPayload {
    branchId?: number;
    productId?: number;
    stock?: number;
}

export interface ProductPriceChangedPayload {
    branchId?: number;
    productId?: number;
    price?: number;
}

export interface BranchUpdatedPayload {
    branchId?: number;
}

export interface BranchDeactivatedPayload {
    branchId?: number;
    isActive?: boolean;
}

export interface RestaurantSuspendedPayload {
    restaurantId?: number;
}
