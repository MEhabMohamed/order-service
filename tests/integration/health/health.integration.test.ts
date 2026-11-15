import "reflect-metadata";
import request from "supertest";
import { createApp } from "../../../src/app";

const app = createApp();

describe("GET /api/health", () => {
    it("pings both eg and ksa test shards and returns 200 ok", async () => {
        const res = await request(app).get("/api/health");

        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(Array.isArray(res.body.shards)).toBe(true);

        const regions = res.body.shards.map((s: { region: string; ok: boolean }) => s.region);
        expect(regions).toContain("eg");
        expect(regions).toContain("ksa");
        for (const shard of res.body.shards) {
            expect(shard.ok).toBe(true);
        }
    });
});

