import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { OrderStatus } from "../enums";

export class UpdateOrderStatusRequestDTO {
    @IsEnum(OrderStatus)
    status!: OrderStatus;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}
