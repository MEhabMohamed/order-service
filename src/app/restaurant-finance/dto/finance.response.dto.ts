export class RestaurantBalanceResponseDTO {
    restaurantId!: number;
    region!: string;
    currency!: string;
    balance!: number;
    updatedAt?: string;
}

export class PayoutResponseDTO {
    id!: number;
    restaurantId!: number;
    region!: string;
    amount!: number;
    currency!: string;
    method!: string;
    status!: string;
    providerReferenceId?: string | null;
    idempotencyKey?: string | null;
    createdAt!: string;
}
