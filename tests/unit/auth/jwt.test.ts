import jwt from "jsonwebtoken";
import { verifyAccessToken, verifyRefreshToken } from "../../../src/lib/auth/jwt";
import { env } from "../../../src/lib/config/env";

describe("Order Service JWT Tests", () => {
    const samplePayload = {
        userId: 42,
        role: "restaurant_user",
        email: "owner@quickbite.test",
        restaurantId: 5,
        restaurantRole: "owner",
        branchIds: [1, 2],
    };

    it("verifies a valid access token and extracts payload fields", () => {
        const token = jwt.sign(samplePayload, env.jwt.accessSecret, { expiresIn: 3600 });
        const decoded = verifyAccessToken(token);

        expect(decoded).toEqual(samplePayload);
    });

    it("verifies a valid refresh token and extracts payload fields", () => {
        const token = jwt.sign(samplePayload, env.jwt.refreshSecret, { expiresIn: 3600 });
        const decoded = verifyRefreshToken(token);

        expect(decoded).toEqual(samplePayload);
    });

    it("throws NotAuthenticated when access token is signed with wrong secret or expired", () => {
        const wrongSecretToken = jwt.sign(samplePayload, "wrong-secret", { expiresIn: 3600 });
        expect(() => verifyAccessToken(wrongSecretToken)).toThrow();

        const expiredToken = jwt.sign(samplePayload, env.jwt.accessSecret, { expiresIn: -10 });
        expect(() => verifyAccessToken(expiredToken)).toThrow();
    });
});

