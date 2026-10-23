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
};

