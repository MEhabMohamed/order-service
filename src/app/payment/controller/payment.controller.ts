import {Request, Response, NextFunction} from "express";
import {injectable, inject} from "tsyringe";
import {TOKENS} from "../../../lib/di/tokens";
import {sendSuccess} from "../../../lib/http/response";
import {PaymentService} from "../service/payment.service";

import {validateBody} from "../../../lib/validation/validate";
import {RefundRequestDTO} from "../dto/refund.dto";

@injectable()
export class PaymentController {
    constructor(@inject(TOKENS.PaymentService) private readonly paymentService: PaymentService) {}

    getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const restaurantId = Number(req.params.restaurantId);
            const paymentId = Number(req.params.paymentId);
            if (!Number.isFinite(paymentId) || paymentId <= 0) {
                return res.status(400).json({error: "invalid paymentId"});
            }
            const result = await this.paymentService.getById(paymentId, restaurantId, req.region!);
            sendSuccess(res, result);
        } catch (err) {
            next(err);
        }
    };

    refund = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const paymentId = Number(req.params.paymentId);
            if (!Number.isFinite(paymentId) || paymentId <= 0) {
                return res.status(400).json({error: "invalid paymentId"});
            }
            const body = await validateBody(RefundRequestDTO, req.body);
            const idempotencyKey = String(req.headers["idempotency-key"] ?? "");
            const result = await this.paymentService.refund(paymentId, body, req.region!, idempotencyKey);
            sendSuccess(res, result, 201);
        } catch (err) {
            next(err);
        }
    };

    getByOrderPublicId = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const publicId = String(req.params.publicId);
            const result = await this.paymentService.getByOrderPublicId(publicId, req.region!);
            sendSuccess(res, result);
        } catch (err) {
            next(err);
        }
    };
}

