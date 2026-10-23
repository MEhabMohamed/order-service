import { ArrayMinSize, IsEnum, IsInt, Max, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { PaymentMethod } from "../enums";

export class OrderItemInputDTO {
    @IsInt()
    @Min(1)
    productId!: number;

    @IsInt()
    @Min(1)
    @Max(50)
    quantity!: number;
}

export class CreateOrderRequestDTO {
    @IsInt()
    @Min(1)
    branchId!: number;

    @IsInt()
    @Min(1)
    customerAddressId!: number;

    @IsEnum(PaymentMethod)
    paymentMethod!: PaymentMethod;

    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => OrderItemInputDTO)
    items!: OrderItemInputDTO[];
}
