import { coreClient } from "./core-client";

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

export class AddressClient {
    async getCustomerAddress(addressId: number): Promise<CustomerAddressSnapshot> {
        const res = await coreClient.request<{ success: boolean; data: CustomerAddressSnapshot }>({
            method: "GET",
            path: `/api/internal/customer-addresses/${addressId}`,
        });
        return res.data;
    }
}

export const addressClient = new AddressClient();
