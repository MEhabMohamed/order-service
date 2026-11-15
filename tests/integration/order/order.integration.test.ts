import "reflect-metadata";
import { randomUUID } from "crypto";
import request from "supertest";
import { createApp } from "../../../src/app";
import { db } from "../../../src/lib/knex/knex";
import { truncateAll } from "../../helpers/db";
import { signTestAccessToken } from "../../helpers/auth";

const app = createApp();

describe("Order API Integration Tests", () => {
    const customerToken = signTestAccessToken({
        userId: 2,
        role: "customer",
        email: "customer@quickbite.test",
    });

    const otherCustomerToken = signTestAccessToken({
        userId: 99,
        role: "customer",
        email: "other@quickbite.test",
    });

    beforeEach(async () => {
        await truncateAll();
    });

    it("lists customer orders, fetches order details with items, and enforces ownership & region", async () => {
        const egDb = db("eg");
        const now = new Date();
        const publicId = randomUUID();

        const [insertedOrder] = await egDb("orders")
            .insert({
                region: "eg",
                public_id: publicId,
                country_code: "eg",
                restaurant_id: 1,
                restaurant_owner_id: 3,
                branch_id: 10,
                customer_id: 2,
                customer_address_id: 1,
                delivery_lat: 30.05,
                delivery_lng: 31.24,
                delivery_address_text_snapshot: "10 Talaat Harb, Cairo",
                branch_lat: 30.0444,
                branch_lng: 31.2357,
                status: "placed",
                subtotal: 10000,
                delivery_fee: 1500,
                service_fee: 500,
                total: 12000,
                commission: 1000,
                currency: "EGP",
                payment_method: "cod",
                created_at: now,
                updated_at: now,
            })
            .returning(["id", "created_at"]);

        await egDb("order_items").insert({
            region: "eg",
            order_id: insertedOrder.id,
            order_created_at: insertedOrder.created_at,
            product_id: 50,
            quantity: 2,
            unit_price_snapshot: 5000,
            name_snapshot: "Classic Burger",
            image_url_snapshot: "https://placehold.co/300?text=Burger",
            line_total: 10000,
            created_at: now,
        });

        // 1. List customer orders on eg shard
        const listRes = await request(app)
            .get("/api/customer/orders?region=eg")
            .set("Cookie", [`access_token=${customerToken}`]);

        expect(listRes.statusCode).toBe(200);
        expect(listRes.body.success).toBe(true);
        expect(listRes.body.data).toHaveLength(1);
        expect(listRes.body.data[0].publicId).toBe(publicId);

        // 2. Get order details with items
        const detailRes = await request(app)
            .get(`/api/orders/${publicId}?region=eg`)
            .set("Cookie", [`access_token=${customerToken}`]);

        expect(detailRes.statusCode).toBe(200);
        expect(detailRes.body.success).toBe(true);
        expect(detailRes.body.data.publicId).toBe(publicId);
        expect(detailRes.body.data.total).toBe(12000);
        expect(detailRes.body.data.items).toHaveLength(1);
        expect(detailRes.body.data.items[0].name).toBe("Classic Burger");

        // 3. Another customer cannot access the order
        const forbiddenRes = await request(app)
            .get(`/api/orders/${publicId}?region=eg`)
            .set("Cookie", [`access_token=${otherCustomerToken}`]);

        expect(forbiddenRes.statusCode).toBe(403);

        // 4. Missing region header/query is rejected
        const missingRegionRes = await request(app)
            .get(`/api/orders/${publicId}`)
            .set("Cookie", [`access_token=${customerToken}`]);

        expect(missingRegionRes.statusCode).toBe(400);
    });
});

