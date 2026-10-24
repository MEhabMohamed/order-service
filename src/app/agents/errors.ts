import { AppError } from "../../lib/error/AppError";

export class AgentInActiveDeliveryError extends AppError {
    constructor() {
        super("AgentInActiveDelivery", 409);
    }
}

export class NotOnlineError extends AppError {
    constructor() {
        super("NotOnline", 409);
    }
}

export class UnauthorizedAgentAccessError extends AppError {
    constructor() {
        super("UnauthorizedAgentAccess", 403);
    }
}
