import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "../../../lib/di/tokens";
import { AssignmentService } from "../service/assignment.service";
import { DeliveryService } from "../service/delivery.service";
import { validateBody } from "../../../lib/validation/validate";
import { AssignDeliveryRequestDTO } from "../dto/assign-delivery.dto";
import { UpdateDeliveryStatusRequestDTO } from "../dto/update-delivery-status.dto";
import { sendSuccess } from "../../../lib/http/response";

@injectable()
export class DeliveryController {
    constructor(
        @inject(TOKENS.AssignmentService) private readonly assignmentService: AssignmentService,
        @inject(TOKENS.DeliveryService) private readonly deliveryService: DeliveryService
    ) {}

    assign = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const orderId = String(req.params.orderId);
            const region = (req as any).region;
            const body = req.body && Object.keys(req.body).length > 0
                ? await validateBody(AssignDeliveryRequestDTO, req.body)
                : {};

            let result;
            if (body.agentId) {
                result = await this.assignmentService.assignManual(orderId, body.agentId, region);
            } else {
                result = await this.assignmentService.tryAssign(orderId, region);
            }

            return sendSuccess(res, result, 201);
        } catch (err) {
            next(err);
        }
    };

    reassign = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const orderId = String(req.params.orderId);
            const region = (req as any).region;

            const result = await this.assignmentService.reassign(orderId, region);
            return sendSuccess(res, result, 201);
        } catch (err) {
            next(err);
        }
    };

    updateStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const orderId = String(req.params.orderId);
            const region = (req as any).region;
            const body = await validateBody(UpdateDeliveryStatusRequestDTO, req.body);
            const user = (req as any).user;

            const result = await this.deliveryService.updateStatus(
                orderId,
                body.status,
                user,
                region,
                body.reason
            );

            return sendSuccess(res, result, 200);
        } catch (err) {
            next(err);
        }
    };
}
