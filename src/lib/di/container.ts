import "reflect-metadata";
import {container} from "tsyringe";
import {TOKENS} from "./tokens";
import {Logger} from "../logger/logger";
import {cacheProvider, redisClient} from "../cache/init";
import {messageBroker} from "../messaging/init";
import {coreClient} from "../core-client/core-client";

import {OrderService} from "../../app/orders/service/order.service";
import {OrderController} from "../../app/orders/controller/order.controller";
import {OrderCoreEventsHandler} from "../../app/orders/events/order-event-handlers";

import {PaymentService} from "../../app/payments/service/payment.service";
import {PaymentController} from "../../app/payments/controller/payment.controller";
import {KashierWebhookService} from "../../app/payments/service/kashier-webhook.service";
import {WebhookController} from "../../app/payments/controller/webhook.controller";

// Infrastructure
container.registerSingleton<Logger>(TOKENS.Logger, Logger);
container.registerInstance(TOKENS.CacheProvider, cacheProvider);
container.registerInstance(TOKENS.RedisClient, redisClient);
container.registerInstance(TOKENS.MessageBroker, messageBroker);
container.registerInstance(TOKENS.CoreClient, coreClient);

// Orders module
container.registerSingleton<OrderService>(TOKENS.OrderService, OrderService);
container.registerSingleton<OrderController>(TOKENS.OrderController, OrderController);
container.registerSingleton<OrderCoreEventsHandler>(TOKENS.OrderCoreEventsHandler, OrderCoreEventsHandler);

// Payments module
container.registerSingleton<PaymentService>(TOKENS.PaymentService, PaymentService);
container.registerSingleton<PaymentController>(TOKENS.PaymentController, PaymentController);
container.registerSingleton<KashierWebhookService>(TOKENS.KashierWebhookService, KashierWebhookService);
container.registerSingleton<WebhookController>(TOKENS.WebhookController, WebhookController);

export {container};
