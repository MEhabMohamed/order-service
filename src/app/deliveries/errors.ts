import { AppError } from "../../lib/error/AppError";

export class OrderNotReadyError extends AppError {
    constructor() {
        super("OrderNotReady", 409);
    }
}

export class OrderAlreadyHasActiveDeliveryError extends AppError {
    constructor() {
        super("OrderAlreadyHasActiveDelivery", 409);
    }
}

export class NoEligibleAgentsError extends AppError {
    constructor() {
        super("NoEligibleAgents", 409);
    }
}

export class MaxReassignmentAttemptsReachedError extends AppError {
    constructor() {
        super("MaxReassignmentAttemptsReached", 409);
    }
}

export class UnauthorizedDeliveryAccessError extends AppError {
    constructor() {
        super("UnauthorizedDeliveryAccess", 403);
    }
}

export class InvalidDeliveryStatusTransitionError extends AppError {
    constructor(from: string, to: string) {
        super(`Invalid delivery status transition from '${from}' to '${to}'`, 409);
    }
}
