import { Response } from "express";
import { PaginationMeta } from "./pagination/cursor-pagination";

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    meta?: object;
}

export const httpStatus = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};

export function sendSuccess<T>(res: Response, data: T, statusCode = httpStatus.OK, meta?: object) {
    const body: ApiResponse<T> = { success: true, data };
    if (meta) body.meta = meta;
    res.status(statusCode).json(body);
}

export function sendPaginated<T>(res: Response, data: T[], meta: PaginationMeta) {
    res.status(httpStatus.OK).json({ success: true, data, meta });
}
