export interface AgentEarningEntityProps {
    id?: number;
    region: string;
    agentId: number;
    orderId: number;
    orderCreatedAt: Date;
    amount: number;
    currency: string;
    earnedAt?: Date;
}

export class AgentEarningEntity {
    id?: number;
    region: string;
    agentId: number;
    orderId: number;
    orderCreatedAt: Date;
    amount: number;
    currency: string;
    earnedAt?: Date;

    constructor(props: AgentEarningEntityProps) {
        this.id = props.id;
        this.region = props.region;
        this.agentId = props.agentId;
        this.orderId = props.orderId;
        this.orderCreatedAt = props.orderCreatedAt;
        this.amount = props.amount;
        this.currency = props.currency;
        this.earnedAt = props.earnedAt;
    }
}
