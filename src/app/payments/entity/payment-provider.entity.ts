export class PaymentProviderEntity {
    id!: number;
    name!: string;
    isEnabled!: boolean;
    priority!: number;

    static toEntity(row: any): PaymentProviderEntity {
        const entity = new PaymentProviderEntity();
        entity.id = Number(row.id);
        entity.name = row.name;
        entity.isEnabled = Boolean(row.is_enabled);
        entity.priority = Number(row.priority);
        return entity;
    }
}
