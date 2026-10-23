import { coreClient } from "./core-client";
import { CustomerAddressSnapshot } from "./types";

export type { CustomerAddressSnapshot };

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
