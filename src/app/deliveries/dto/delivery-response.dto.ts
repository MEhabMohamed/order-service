import { DeliveryStatus } from "../enums";

export class DeliveryResponseDTO {
    id!: number;
    orderPublicId!: string;
    agent!: { id: number; name: string; phone?: string };
    status!: DeliveryStatus;
    pickup!: { lat: number; lng: number };
    dropoff!: { lat: number; lng: number };
    distanceMeters!: number | null;
    assignedAt!: string;
}

export class DeliveryStatusResponseDTO {
    id!: number | string;
    status!: DeliveryStatus;
    updatedAt!: string;
}
