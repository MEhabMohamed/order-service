import { coreClient } from "./core-client";
import { redisClient } from "../cache/init";
import { AgentProfile } from "./types";
import { toSec } from "../../pkg/utils/time";

export type { AgentProfile };

export class AgentClient {
    async getAgent(agentId: number): Promise<AgentProfile> {
        const cacheKey = `core:agent:${agentId}`;
        const cached = await redisClient.get(cacheKey).catch(() => null);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch {
                // ignore
            }
        }

        try {
            const res = await coreClient.request<{ success: boolean; data: AgentProfile }>({
                method: "GET",
                path: `/api/internal/users/${agentId}?role=delivery_agent`,
            });
            const data = res.data || { id: agentId, name: `Agent ${agentId}` };
            await redisClient.set(cacheKey, JSON.stringify(data), "EX", toSec.minute(5)).catch(() => {});
            return data;
        } catch {
            return {
                id: agentId,
                name: `Agent ${agentId}`,
            };
        }
    }
}

export const agentClient = new AgentClient();
