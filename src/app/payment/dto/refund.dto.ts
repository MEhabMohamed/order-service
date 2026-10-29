import {IsInt, IsNotEmpty, IsOptional, IsString, Min} from "class-validator";

export class RefundRequestDTO {
    /**
     * Optional refund amount in MINOR units (piasters/halalas).
     * If omitted, defaults to full remaining refundable balance.
     */
    @IsOptional()
    @IsInt()
    @Min(1)
    amount?: number;

    @IsString()
    @IsNotEmpty()
    reason!: string;
}

export class RefundResponseDTO {
    refundId!: number;
    status!: string;
    amount!: number;
    currency!: string;

    static from(tx: {id: number; status: string; amount: number; currency: string}): RefundResponseDTO {
        const dto = new RefundResponseDTO();
        dto.refundId = tx.id;
        dto.status = tx.status;
        dto.amount = tx.amount;
        dto.currency = tx.currency;
        return dto;
    }
}
