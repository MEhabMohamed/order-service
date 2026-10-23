import { NextFunction, Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "../../../lib/di/tokens";
import { httpStatus, sendSuccess } from "../../../lib/http/response";
import { validateBody } from "../../../lib/validation/validate";
import { InitPaymentRequestDTO } from "../dto/init-payment.dto";
import { RefundRequestDTO } from "../dto/refund-request.dto";
import { PaymentService } from "../service/payment.service";

@injectable()
export class PaymentController {
    constructor(
        @inject(TOKENS.PaymentService)
        private readonly paymentService: PaymentService
    ) {}

    init = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await validateBody(InitPaymentRequestDTO, req.body);
            const result = await this.paymentService.init(
                req.user?.userId!,
                req.region!,
                data
            );
            sendSuccess(res, result, httpStatus.OK);
        } catch (err) {
            next(err);
        }
    };

    getPayment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const paymentId = Number(req.params.paymentId);
            const result = await this.paymentService.getById(
                req.user!,
                req.region!,
                paymentId
            );
            sendSuccess(res, result, httpStatus.OK);
        } catch (err) {
            next(err);
        }
    };

    refund = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const paymentId = Number(req.params.paymentId);
            const data = await validateBody(RefundRequestDTO, req.body);
            const result = await this.paymentService.refund(
                req.user!,
                req.region!,
                paymentId,
                data
            );
            sendSuccess(res, result, httpStatus.ACCEPTED);
        } catch (err) {
            next(err);
        }
    };
}
