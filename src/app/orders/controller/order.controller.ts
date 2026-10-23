import { NextFunction, Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "../../../lib/di/tokens";
import { httpStatus, sendPaginated, sendSuccess } from "../../../lib/http/response";
import { validateBody } from "../../../lib/validation/validate";
import { CreateOrderRequestDTO } from "../dto/create-order.dto";
import { UpdateOrderStatusRequestDTO } from "../dto/update-order-status.dto";
import { OrderService } from "../service/order.service";
import { OrderStatus } from "../enums";

@injectable()
export class OrderController {
    constructor(
        @inject(TOKENS.OrderService)
        private readonly orderService: OrderService
    ) {}

    placeOrder = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await validateBody(CreateOrderRequestDTO, req.body);
            const idempotencyKey = req.header("Idempotency-Key");
            const result = await this.orderService.placeOrder(
                req.user?.userId!,
                req.region!,
                data,
                idempotencyKey
            );
            sendSuccess(res, result, httpStatus.CREATED);
        } catch (error) {
            next(error);
        }
    };

    getOrder = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const publicId = String(req.params.publicId);
            const result = await this.orderService.getOrder(publicId, req.region!, req.user!);
            sendSuccess(res, result, httpStatus.OK);
        } catch (error) {
            next(error);
        }
    };

    listCustomerOrders = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
            const limit = req.query.limit ? Number(req.query.limit) : 20;
            const year = req.query.year ? Number(req.query.year) : undefined;

            const { orders, nextCursor, hasMore } = await this.orderService.listCustomerOrders(
                req.user?.userId!,
                req.region!,
                { cursor, limit, year }
            );

            sendPaginated(res, orders, {
                nextCursor: nextCursor || null,
                hasMore,
                count: orders.length,
            });
        } catch (error) {
            next(error);
        }
    };

    listRestaurantOrders = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const branchId = Number(req.query.branchId);
            const status = req.query.status as OrderStatus | undefined;
            const from = req.query.from ? String(req.query.from) : undefined;
            const to = req.query.to ? String(req.query.to) : undefined;
            const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
            const limit = req.query.limit ? Number(req.query.limit) : 20;

            const { orders, nextCursor, hasMore } = await this.orderService.listRestaurantOrders(
                branchId,
                req.region!,
                { status, from, to, cursor, limit }
            );

            sendPaginated(res, orders, {
                nextCursor: nextCursor || null,
                hasMore,
                count: orders.length,
            });
        } catch (error) {
            next(error);
        }
    };

    updateStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const publicId = String(req.params.publicId);
            const data = await validateBody(UpdateOrderStatusRequestDTO, req.body);
            const result = await this.orderService.updateStatus(
                publicId,
                req.region!,
                data.status,
                data.reason,
                req.user
            );
            sendSuccess(res, result, httpStatus.OK);
        } catch (error) {
            next(error);
        }
    };
}
