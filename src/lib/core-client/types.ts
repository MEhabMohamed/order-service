export interface CoreClientRequest {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    path: string;                       // e.g. "/api/internal/branches/123"
    body?: unknown;
    correlationId?: string;
    idempotencyKey?: string;
}

export interface BranchMetadata {
    id: number;
    region: string;
    restaurantId: number;
    restaurantOwnerId: number;
    restaurantStatus: string;
    acceptOrders: boolean;
    isActive: boolean;
    deliveryFee: number;
    commissionBps: number;
    currency: string;
    lat: number;
    lng: number;
    name: string;
    addressText: string;
}

export interface BranchProduct {
    productId: number;
    name: string;
    imageUrl?: string | null;
    price: number;
    stock: number;
    isAvailable: boolean;
}

export interface CustomerAddressSnapshot {
    id: number;
    userId: number;
    lat: number;
    lng: number;
    addressText: string;
    city: string;
    country: string;
    building?: string;
    apartmentNumber?: string;
    label: string;
}
