import { AppError } from "../../lib/error/AppError";

export class InsufficientBalanceError extends AppError {
    constructor() {
        super("Insufficient restaurant balance for payout", 409);
    }
}

export class UnauthorizedFinanceAccessError extends AppError {
    constructor() {
        super("UnauthorizedFinanceAccess", 403);
    }
}

export class RestaurantNotFoundError extends AppError {
    constructor() {
        super("RestaurantNotFound", 404);
    }
}

export class InvalidPayoutAmountError extends AppError {
    constructor() {
        super("Payout amount must be greater than zero", 400);
    }
}
