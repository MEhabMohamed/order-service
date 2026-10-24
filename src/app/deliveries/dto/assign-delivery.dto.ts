import { IsInt, IsOptional, Min } from "class-validator";

export class AssignDeliveryRequestDTO {
    @IsOptional()
    @IsInt()
    @Min(1)
    agentId?: number;
}
