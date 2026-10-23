import { NextFunction, Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "../../../lib/di/tokens";
import { KashierWebhookService } from "../service/kashier-webhook.service";

@injectable()
export class WebhookController {
    constructor(
        @inject(TOKENS.KashierWebhookService)
        private readonly webhookService: KashierWebhookService
    ) {}

    handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const provider = req.params.provider as string;
            const sigHeader = req.header("x-kashier-signature");
            const signature = (Array.isArray(sigHeader) ? sigHeader[0] : sigHeader) || "";

            await this.webhookService.handleWebhook(
                provider,
                signature,
                req.body,
                req.region
            );

            // Kashier accepts 200 or 409 as acknowledged
            res.status(200).json({ acknowledged: true });
        } catch (err) {
            next(err);
        }
    };
}
