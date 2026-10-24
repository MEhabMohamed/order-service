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

import {DeliveryService} from "../../app/deliveries/service/delivery.service";
import {AssignmentService} from "../../app/deliveries/service/assignment.service";
import {DeliveryController} from "../../app/deliveries/controller/delivery.controller";

import {PresenceService} from "../../app/agents/service/presence.service";
import {AgentService} from "../../app/agents/service/agent.service";
import {EarningService} from "../../app/agents/service/earning.service";
import {AgentController} from "../../app/agents/controller/agent.controller";
import {PresenceController} from "../../app/agents/controller/presence.controller";

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

// Deliveries module
container.registerSingleton<DeliveryService>(TOKENS.DeliveryService, DeliveryService);
container.registerSingleton<AssignmentService>(TOKENS.AssignmentService, AssignmentService);
container.registerSingleton<DeliveryController>(TOKENS.DeliveryController, DeliveryController);

import { FinanceService } from "../../app/restaurant-finance/service/finance.service";
import { FinanceController } from "../../app/restaurant-finance/controller/finance.controller";

// Agents module
container.registerSingleton<PresenceService>(TOKENS.PresenceService, PresenceService);
container.registerSingleton<AgentService>(TOKENS.AgentService, AgentService);
container.registerSingleton<EarningService>(TOKENS.EarningService, EarningService);
container.registerSingleton<AgentController>(TOKENS.AgentController, AgentController);
container.registerSingleton<PresenceController>(TOKENS.PresenceController, PresenceController);

// Restaurant finance module
container.registerSingleton<FinanceService>(TOKENS.FinanceService, FinanceService);
container.registerSingleton<FinanceController>(TOKENS.FinanceController, FinanceController);

export {container};

