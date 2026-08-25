import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.module";

// TOKEN_ECONOMY_REDESIGN.md — replaces ReserveService (SPEC.md §40). A
// supplier pays 2% of the sale price into this corpus on every confirmed
// delivery. The corpus is never spent down — only its eventual investment
// returns are meant to be distributed as dividends, which isn't built yet
// (no decided distribution cadence, no real banking/FD integration — see
// the design doc's open questions). This service only tracks contributions
// accumulating toward that; it does not invent a fake "your dividend" number.
@Injectable()
export class CorpusFundService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Idempotent by (refType, refId), same discipline as every other ledger
   * in this codebase — a retried confirm-delivery call never double-contributes.
   */
  async creditContribution(params: {
    client: PoolClient;
    amountPaise: number;
    refType: string;
    refId: string | number;
  }): Promise<{ credited: boolean }> {
    const { client, amountPaise, refType, refId } = params;
    try {
      await client.query(
        `INSERT INTO corpus_fund_ledger (entry, amount_paise, ref_type, ref_id) VALUES ('contribution', $1, $2, $3)`,
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

  async getTotal(): Promise<{ corpusPaise: number }> {
    const { rows } = await this.pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM corpus_fund_ledger`
    );
    return { corpusPaise: Number(rows[0].total) };
  }
}
