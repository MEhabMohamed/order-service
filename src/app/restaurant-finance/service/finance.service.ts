import { inject, injectable } from "tsyringe";
import { db } from "../../../lib/knex/knex";
import { TOKENS } from "../../../lib/di/tokens";
import { Logger } from "../../../lib/logger/logger";
import { findAllBalances, findBalanceForUpdate, upsertBalance } from "../../deliveries/repository/restaurant-balance.repo";
import { createTransaction } from "../../payments/repository/transaction.repo";
import { TransactionMethod, TransactionStatus, TransactionType } from "../../payments/enums";
import { InsufficientBalanceError, InvalidPayoutAmountError } from "../errors";
import { CreatePayoutRequestDTO } from "../dto/create-payout.dto";
import { PayoutResponseDTO, RestaurantBalanceResponseDTO } from "../dto/finance.response.dto";
import { findPayouts } from "../repository/finance.repo";

@injectable()
export class FinanceService {
    constructor(
        @inject(TOKENS.Logger) private readonly logger: Logger
    ) {}

    async getBalance(
        restaurantId: number,
        region: string,
        currency?: string
    ): Promise<RestaurantBalanceResponseDTO[]> {
        const conn = db(region);
        const rows = await findAllBalances(restaurantId, conn);

        if (currency) {
            const filtered = rows.filter((r) => r.currency.toUpperCase() === currency.toUpperCase());
            if (filtered.length === 0) {
                return [
                    {
                        restaurantId,
                        region,
                        currency: currency.toUpperCase(),
                        balance: 0,
                    },
                ];
            }
            return filtered.map((r) => ({
                restaurantId: r.restaurantId,
                region: r.region,
                currency: r.currency,
                balance: r.balance,
                updatedAt: r.updatedAt ? r.updatedAt.toISOString() : undefined,
            }));
        }

        return rows.map((r) => ({
            restaurantId: r.restaurantId,
            region: r.region,
            currency: r.currency,
            balance: r.balance,
            updatedAt: r.updatedAt ? r.updatedAt.toISOString() : undefined,
        }));
    }

    async listPayouts(
        restaurantId: number,
        region: string,
        query: { from?: string; to?: string; cursor?: string; limit?: number }
    ): Promise<{ payouts: PayoutResponseDTO[]; nextCursor: string | null; hasMore: boolean }> {
        const conn = db(region);
        const fromDate = query.from ? new Date(query.from) : undefined;
        const toDate = query.to ? new Date(query.to) : undefined;

        const { payouts, nextCursor, hasMore } = await findPayouts(
            restaurantId,
            { from: fromDate, to: toDate, cursor: query.cursor, limit: query.limit },
            conn
        );

        const dtos: PayoutResponseDTO[] = payouts.map((p) => ({
            id: p.id!,
            restaurantId: p.dstAccId!,
            region: p.region,
            amount: p.amount,
            currency: p.currency,
            method: p.method,
            status: p.status,
            providerReferenceId: p.providerReferenceId || null,
            idempotencyKey: p.idempotencyKey || null,
            createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
        }));

        return { payouts: dtos, nextCursor, hasMore };
    }

    async recordPayout(
        data: CreatePayoutRequestDTO,
        region: string,
        idempotencyKey?: string
    ): Promise<PayoutResponseDTO> {
        if (!data.amount || data.amount <= 0) {
            throw new InvalidPayoutAmountError();
        }

        const conn = db(region);
        const currency = data.currency.toUpperCase();
        const method = data.method === "system" ? TransactionMethod.SYSTEM : TransactionMethod.BANK_TRANSFER;

        return await conn.transaction(async (trx) => {
            // 1. Lock balance row for update
            const currentBalance = await findBalanceForUpdate(data.restaurantId, currency, trx);
            if (!currentBalance || currentBalance.balance < data.amount) {
                this.logger.warn("Payout rejected due to insufficient restaurant balance", {
                    restaurantId: data.restaurantId,
                    available: currentBalance?.balance ?? 0,
                    requested: data.amount,
                    currency,
                });
                throw new InsufficientBalanceError();
            }

            // 2. Decrement balance
            await upsertBalance(data.restaurantId, region, currency, -data.amount, trx);

            // 3. Record payout in transactions ledger
            const tx = await createTransaction(
                {
                    region,
                    transactionType: TransactionType.PAYOUT,
                    method,
                    status: TransactionStatus.SUCCEEDED,
                    amount: data.amount,
                    currency,
                    dstAccId: data.restaurantId,
                    providerReferenceId: data.providerReferenceId,
                    idempotencyKey,
                },
                trx
            );

            this.logger.info("Recorded restaurant payout successfully", {
                restaurantId: data.restaurantId,
                amount: data.amount,
                currency,
                transactionId: tx.id,
            });

            return {
                id: tx.id!,
                restaurantId: data.restaurantId,
                region,
                amount: tx.amount,
                currency: tx.currency,
                method: tx.method,
                status: tx.status,
                providerReferenceId: tx.providerReferenceId || null,
                idempotencyKey: tx.idempotencyKey || null,
                createdAt: tx.createdAt ? tx.createdAt.toISOString() : new Date().toISOString(),
            };
        });
    }
}
