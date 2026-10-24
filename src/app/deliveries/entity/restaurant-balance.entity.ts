export interface RestaurantBalanceEntityProps {
    restaurantId: number;
    region: string;
    currency: string;
    balance: number;
    updatedAt?: Date;
}

export class RestaurantBalanceEntity {
    restaurantId: number;
    region: string;
    currency: string;
    balance: number;
    updatedAt?: Date;

    constructor(props: RestaurantBalanceEntityProps) {
        this.restaurantId = props.restaurantId;
        this.region = props.region;
        this.currency = props.currency;
        this.balance = props.balance;
        this.updatedAt = props.updatedAt;
    }
}
