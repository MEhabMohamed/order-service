import { inject, injectable } from "tsyringe";
import Redis from "ioredis";
import { TOKENS } from "../../../lib/di/tokens";
import { Logger } from "../../../lib/logger/logger";
import { env } from "../../../lib/config/env";
import { toMs } from "../../../pkg/utils/time";
import { AgentInActiveDeliveryError, NotOnlineError } from "../errors";
import { db } from "../../../lib/knex/knex";
import { findActiveOrderByAgent, unassignDeliveryAgent } from "../../orders/repository/order.repo";
import { OrderStatus } from "../../orders/enums";
import { container } from "../../../lib/di/container";

export interface CandidateAgent {
    agentId: number;
    distanceMeters: number;
}

@injectable()
export class PresenceService {
    constructor(
        @inject(TOKENS.RedisClient) private readonly redis: Redis,
        @inject(TOKENS.Logger) private readonly logger: Logger
    ) {}

    async goOnline(agentId: number, region: string, lat: number, lng: number): Promise<{ ok: boolean }> {
        const geoKey = `presence:geo:${region}`;
        const metaKey = `presence:meta:${region}:${agentId}`;
        const busyKey = `presence:busy:${region}`;

        await this.redis.geoadd(geoKey, lng, lat, String(agentId));
        await this.redis.hset(metaKey, {
            isOnline: "1",
            lastSeenAt: String(Date.now()),
            lat: String(lat),
            lng: String(lng),
        });
        await this.redis.srem(busyKey, String(agentId));

        this.logger.info(`Agent ${agentId} went online in region ${region} at (${lat}, ${lng})`);
        return { ok: true };
    }

    async goOffline(agentId: number, region: string): Promise<{ ok: boolean }> {
        const conn = db(region);
        const activeOrder = await findActiveOrderByAgent(agentId, conn).catch(() => null);

        if (activeOrder) {
            if (activeOrder.status === OrderStatus.PICKED) {
                throw new AgentInActiveDeliveryError();
            }
            if (activeOrder.status === OrderStatus.ASSIGNED) {
                await unassignDeliveryAgent(activeOrder.publicId, conn).catch(() => {});
                this.logger.warn(`Agent ${agentId} went offline with assigned order ${activeOrder.publicId}. Order unassigned.`);
            }
        }

        const geoKey = `presence:geo:${region}`;
        const metaKey = `presence:meta:${region}:${agentId}`;
        const busyKey = `presence:busy:${region}`;

        await this.redis.zrem(geoKey, String(agentId));
        await this.redis.hset(metaKey, {
            isOnline: "0",
            lastSeenAt: String(Date.now()),
        });
        await this.redis.srem(busyKey, String(agentId));

        this.logger.info(`Agent ${agentId} went offline in region ${region}`);
        return { ok: true };
    }

    async ping(agentId: number, region: string, lat: number, lng: number): Promise<{ ok: boolean }> {
        const metaKey = `presence:meta:${region}:${agentId}`;
        const meta = await this.redis.hgetall(metaKey);

        if (!meta || meta.isOnline !== "1") {
            throw new NotOnlineError();
        }

        const now = Date.now();
        const geoKey = `presence:geo:${region}`;

        await this.redis.geoadd(geoKey, lng, lat, String(agentId));
        await this.redis.hset(metaKey, {
            lastSeenAt: String(now),
            lat: String(lat),
            lng: String(lng),
        });

        // Broadcast delivery location if currently in an active delivery
        const conn = db(region);
        const activeOrder = await findActiveOrderByAgent(agentId, conn).catch(() => null);
        if (activeOrder) {
            this.emitWs(`customer:${activeOrder.customerId}`, "delivery.position", {
                orderId: activeOrder.publicId,
                agentId,
                lat,
                lng,
                ts: new Date(now).toISOString(),
            });
        }

        return { ok: true };
    }

    async findNearbyEligibleAgents(
        region: string,
        branchLat: number,
        branchLng: number,
        radiusMeters: number = env.delivery.assignmentRadiusMeters,
        limit: number = 5
    ): Promise<CandidateAgent[]> {
        const geoKey = `presence:geo:${region}`;
        const busyKey = `presence:busy:${region}`;

        let results: any[] = [];
        try {
            // Redis 6.2+ GEOSEARCH
            results = (await (this.redis as any).geosearch(
                geoKey,
                "FROMLONLAT",
                branchLng,
                branchLat,
                "BYRADIUS",
                radiusMeters,
                "m",
                "WITHDIST",
                "ASC"
            )) || [];
        } catch {
            // Fallback to GEORADIUS
            try {
                results = (await (this.redis as any).georadius(
                    geoKey,
                    branchLng,
                    branchLat,
                    radiusMeters,
                    "m",
                    "WITHDIST",
                    "ASC"
                )) || [];
            } catch (err) {
                this.logger.error("Redis geo search failed", { error: (err as Error).message });
                return [];
            }
        }

        if (!results || results.length === 0) {
            return [];
        }

        const staleThresholdMs = toMs.second(env.delivery.presenceStaleSec);
        const now = Date.now();
        const candidates: CandidateAgent[] = [];

        for (const item of results) {
            const agentIdStr = Array.isArray(item) ? item[0] : item;
            const distStr = Array.isArray(item) ? item[1] : "0";
            const agentId = Number(agentIdStr);
            const distMeters = Math.round(Number(distStr));

            if (!agentId) continue;

            const isBusy = await this.redis.sismember(busyKey, agentIdStr);
            if (isBusy) continue;

            const metaKey = `presence:meta:${region}:${agentIdStr}`;
            const meta = await this.redis.hgetall(metaKey);
            if (!meta || meta.isOnline !== "1") continue;

            const lastSeen = Number(meta.lastSeenAt || 0);
            if (now - lastSeen > staleThresholdMs) {
                // Stale agent presence
                continue;
            }

            candidates.push({ agentId, distanceMeters: distMeters });
            if (candidates.length >= limit) {
                break;
            }
        }

        return candidates;
    }

    async markAgentBusy(region: string, agentId: number): Promise<void> {
        await this.redis.sadd(`presence:busy:${region}`, String(agentId));
    }

    async releaseAgentBusy(region: string, agentId: number): Promise<void> {
        await this.redis.srem(`presence:busy:${region}`, String(agentId));
    }

    private emitWs(room: string, event: string, payload: any): void {
        try {
            const io = container.resolve<any>(TOKENS.WsServer);
            if (io && typeof io.to === "function") {
                io.to(room).emit(event, payload);
            }
        } catch {
            // WS non-blocking
        }
    }
}
