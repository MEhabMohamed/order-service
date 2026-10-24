import { Router } from "express";
import { authenticate } from "../../lib/auth/guard";
import { requireRegion } from "../../lib/sharding/region-resolver";
import { container } from "../../lib/di/container";
import { TOKENS } from "../../lib/di/tokens";
import { PresenceController } from "./controller/presence.controller";
import { AgentController } from "./controller/agent.controller";

export const agentRouter = Router();

const presenceController = container.resolve<PresenceController>(TOKENS.PresenceController);
const agentController = container.resolve<AgentController>(TOKENS.AgentController);

// Presence
agentRouter.post(
    "/agents/presence/online",
    authenticate,
    requireRegion,
    presenceController.online
);

agentRouter.post(
    "/agents/presence/offline",
    authenticate,
    requireRegion,
    presenceController.offline
);

agentRouter.post(
    "/agents/presence/ping",
    authenticate,
    requireRegion,
    presenceController.ping
);

// Tasks & Earnings
agentRouter.get(
    "/agents/tasks",
    authenticate,
    requireRegion,
    agentController.getTasks
);

agentRouter.get(
    "/agents/earnings",
    authenticate,
    requireRegion,
    agentController.getEarnings
);
