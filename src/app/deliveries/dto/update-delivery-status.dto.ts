import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { DeliveryStatus } from "../enums";

export class UpdateDeliveryStatusRequestDTO {
    @IsEnum(DeliveryStatus)
    status!: DeliveryStatus;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}
