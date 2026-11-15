import jwt from "jsonwebtoken";
import { env } from "../../src/lib/config/env";
import type { JWTPayload } from "../../src/lib/auth/jwt";

export function signTestAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, env.jwt.accessSecret, {
        expiresIn: Number(env.jwt.accessExpiresIn) || 3600,
    });
}

