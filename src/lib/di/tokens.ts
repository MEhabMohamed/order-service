export const TOKENS = {
    // infra
    Logger: Symbol.for("Logger"),
    CacheProvider: Symbol.for("CacheProvider"),
    RedisClient: Symbol.for("RedisClient"),
    MessageBroker: Symbol.for("MessageBroker"),
    CoreClient: Symbol.for("CoreClient"),
    WsServer: Symbol.for("WsServer"),

    // domain
    OrderService: Symbol.for("OrderService"),
    OrderController: Symbol.for("OrderController"),
    OrderCoreEventsHandler: Symbol.for("OrderCoreEventsHandler"),

    PaymentService: Symbol.for("PaymentService"),
    PaymentController: Symbol.for("PaymentController"),
    KashierWebhookService: Symbol.for("KashierWebhookService"),
    WebhookController: Symbol.for("WebhookController"),

    // Deliveries module
    DeliveryService: Symbol.for("DeliveryService"),
    AssignmentService: Symbol.for("AssignmentService"),
    DeliveryController: Symbol.for("DeliveryController"),

    // Agents module
    PresenceService: Symbol.for("PresenceService"),
    AgentService: Symbol.for("AgentService"),
    EarningService: Symbol.for("EarningService"),
    AgentController: Symbol.for("AgentController"),
    PresenceController: Symbol.for("PresenceController"),

    // Restaurant finance module
    FinanceService: Symbol.for("FinanceService"),
    FinanceController: Symbol.for("FinanceController"),
};

