import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.module";

// SPEC.md §40 — real rupees, reserved 1:1 against tokens the moment they're
// realised. Same posture as LedgerService (token_ledger): every credit here
// MUST run inside the caller's transaction, alongside whatever event just
// realised those tokens — never called standalone.
@Injectable()
export class ReserveService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Idempotent by (refType, refId), same discipline as fund_ledger's
   * accrual — a retried confirm-delivery call never double-reserves.
   */
  async creditReserve(params: {
    client: PoolClient;
    amountPaise: number;
    refType: string;
    refId: string | number;
  }): Promise<{ credited: boolean }> {
    const { client, amountPaise, refType, refId } = params;
    try {
      await client.query(
        `INSERT INTO reserve_ledger (entry, amount_paise, ref_type, ref_id) VALUES ('accrual', $1, $2, $3)`,
        [amountPaise, refType, String(refId)]
      );
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        return { credited: false };
      }
      throw err;
    }
    return { credited: true };
  }

  async getTotal(): Promise<{ reservedPaise: number }> {
    const { rows } = await this.pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM reserve_ledger`
    );
    return { reservedPaise: Number(rows[0].total) };
  }
}
