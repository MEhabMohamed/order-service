import "reflect-metadata";
import {container} from "tsyringe";
import {TOKENS} from "./tokens";
import {Logger} from "../logger/logger";
import {cacheProvider} from "../cache/init";
import {messageBroker} from "../messaging/init";
import {coreClient} from "../core-client/core-client";

import {OrderService} from "../../app/orders/service/order.service";
import {OrderController} from "../../app/orders/controller/order.controller";

// Infrastructure
container.registerSingleton<Logger>(TOKENS.Logger, Logger);
container.registerInstance(TOKENS.CacheProvider, cacheProvider);
container.registerInstance(TOKENS.MessageBroker, messageBroker);
container.registerInstance(TOKENS.CoreClient, coreClient);

// Orders module
container.registerSingleton<OrderService>(TOKENS.OrderService, OrderService);
container.registerSingleton<OrderController>(TOKENS.OrderController, OrderController);

export {container};

