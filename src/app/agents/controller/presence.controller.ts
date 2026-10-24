import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "../../../lib/di/tokens";
import { PresenceService } from "../service/presence.service";
import { validateBody } from "../../../lib/validation/validate";
import { PresenceOnlineRequestDTO } from "../dto/presence.dto";
import { sendSuccess } from "../../../lib/http/response";

@injectable()
export class PresenceController {
    constructor(
        @inject(TOKENS.PresenceService) private readonly presenceService: PresenceService
    ) {}

    online = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = await validateBody(PresenceOnlineRequestDTO, req.body);
            const user = (req as any).user;
            const region = (req as any).region;

            const result = await this.presenceService.goOnline(
                user.userId,
                region,
                body.lat,
                body.lng
            );

            return sendSuccess(res, result, 200);
        } catch (err) {
            next(err);
        }
    };

    offline = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const region = (req as any).region;

            const result = await this.presenceService.goOffline(
                user.userId,
                region
            );

            return sendSuccess(res, result, 200);
        } catch (err) {
            next(err);
        }
    };

    ping = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = await validateBody(PresenceOnlineRequestDTO, req.body);
            const user = (req as any).user;
            const region = (req as any).region;

            const result = await this.presenceService.ping(
                user.userId,
                region,
                body.lat,
                body.lng
            );

            return sendSuccess(res, result, 200);
        } catch (err) {
            next(err);
        }
    };
}
