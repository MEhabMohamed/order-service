export type CoreEventHandler<T = any> = (payload: T) => Promise<void>;

export interface CoreEventEnvelope {
    eventId: string;
    eventType: string;
    occurredAt: string;
    payload: unknown;
}
