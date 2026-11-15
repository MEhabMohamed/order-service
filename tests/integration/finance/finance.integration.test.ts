import "reflect-metadata";
import { randomUUID } from "crypto";
import request from "supertest";
import { createApp } from "../../../src/app";
import { db } from "../../../src/lib/knex/knex";
import { truncateAll } from "../../helpers/db";
import { signTestAccessToken } from "../../helpers/auth";

const app = createApp();

describe("Finance API Integration Tests", () => {
    const adminToken = signTestAccessToken({
        userId: 1,
        role: "system_admin",
        email: "admin@quickbite.test",
    });

    beforeEach(async () => {
        await truncateAll();
    });

    it("reads restaurant balance and records an idempotent payout on the eg shard", async () => {
        const egDb = db("eg");
        const now = new Date();

        // Seed restaurant balance on eg shard
        await egDb("restaurant_balances").insert({
            restaurant_id: 1,
            region: "eg",
            currency: "EGP",
            balance: 50000,
            updated_at: now,
        });

        // Seed an order so findOwnerIdForRestaurant resolves the real owner ID
        await egDb("orders").insert({
            region: "eg",
            public_id: randomUUID(),
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
            status: "delivered",
            subtotal: 10000,
            delivery_fee: 1500,
            service_fee: 500,
            total: 12000,
            commission: 1000,
            currency: "EGP",
            payment_method: "online",
            created_at: now,
            updated_at: now,
        });

        // 1. Read initial balance
        const balRes = await request(app)
            .get("/api/restaurants/1/balance?region=eg")
            .set("Cookie", [`access_token=${adminToken}`]);

        expect(balRes.statusCode).toBe(200);
        expect(balRes.body.success).toBe(true);
        expect(balRes.body.data.restaurantId).toBe(1);
        expect(balRes.body.data.balances).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ currency: "EGP", balance: 50000 }),
            ]),
        );

        // 2. Record payout
        const payoutKey = `test-payout-${randomUUID()}`;
        const payoutRes = await request(app)
            .post("/api/admin/restaurants/1/payouts?region=eg")
            .set("Cookie", [`access_token=${adminToken}`])
            .set("Idempotency-Key", payoutKey)
            .send({
                amount: 15000,
                currency: "EGP",
                providerReferenceId: "bank-ref-001",
            });

        expect(payoutRes.statusCode).toBe(201);
        expect(payoutRes.body.success).toBe(true);
        expect(payoutRes.body.data.amount).toBe(15000);
        expect(payoutRes.body.data.currency).toBe("EGP");

        // 3. Verify balance decremented in DB
        const updatedBal = await egDb("restaurant_balances")
            .where({ restaurant_id: 1, currency: "EGP" })
            .first();
        expect(updatedBal.balance).toBe(35000);

        // 4. Verify payout appears in listPayouts
        const listRes = await request(app)
            .get("/api/restaurants/1/payouts?region=eg")
            .set("Cookie", [`access_token=${adminToken}`]);

        expect(listRes.statusCode).toBe(200);
        expect(listRes.body.data).toHaveLength(1);
        expect(listRes.body.data[0].providerReferenceId).toBe("bank-ref-001");

        // 5. Verify ksa shard isolation (no balance on ksa)
        const ksaBalRes = await request(app)
            .get("/api/restaurants/1/balance?region=ksa")
            .set("Cookie", [`access_token=${adminToken}`]);

        expect(ksaBalRes.statusCode).toBe(200);
        expect(ksaBalRes.body.data.balances).toEqual([]);
    });
});

