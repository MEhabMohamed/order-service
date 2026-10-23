import { AppError } from "../../lib/error/AppError";

export class OrderNotFoundError extends AppError {
    constructor() {
        super("OrderNotFound", 404);
    }
}

export class BranchNotAcceptingOrdersError extends AppError {
    constructor(message: string = "BranchNotAcceptingOrders") {
        super(message, 409);
    }
}

export class OutOfStockError extends AppError {
    constructor(public readonly details: Array<{ productId: number; requested: number; available: number }>) {
        super("OutOfStock", 409);
    }
}

export class InvalidStatusTransitionError extends AppError {
    constructor(public readonly from: string, public readonly to: string) {
        super(`InvalidStatusTransition: cannot transition from ${from} to ${to}`, 409);
    }
}

export class CancellationWindowExpiredError extends AppError {
    constructor() {
        super("CancellationWindowExpired", 409);
    }
}

export class UnauthorizedOrderAccessError extends AppError {
    constructor() {
        super("User not authorised", 403);
    }
}
