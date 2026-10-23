import { AppError } from "../../lib/error/AppError";

export class InvalidSignatureError extends AppError {
    constructor(message: string = "Invalid webhook signature") {
        super(message, 401);
    }
}

export class OrderNotPendingPaymentError extends AppError {
    constructor(status: string) {
        super(`Order is not in pending_payment status (current: ${status})`, 409);
    }
}

export class PaymentNotFoundError extends AppError {
    constructor(id?: string | number) {
        super(id ? `Payment ${id} not found` : "Payment not found", 404);
    }
}

export class PaymentAlreadyRefundedError extends AppError {
    constructor() {
        super("Payment is already refunded", 409);
    }
}

export class InvalidRefundAmountError extends AppError {
    constructor(message: string = "Refund amount must not exceed original charge amount") {
        super(message, 400);
    }
}

export class UnsupportedPaymentProviderError extends AppError {
    constructor(provider: string) {
        super(`Unsupported payment provider: ${provider}`, 400);
    }
}

