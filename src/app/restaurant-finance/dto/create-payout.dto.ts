export class CreatePayoutRequestDTO {
    restaurantId!: number;
    amount!: number;
    currency!: string;
    providerReferenceId?: string;
    method?: "bank_transfer" | "system";
    note?: string;
}
