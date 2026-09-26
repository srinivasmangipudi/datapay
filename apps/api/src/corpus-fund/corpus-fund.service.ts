import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.module";

// TOKEN_ECONOMY_REDESIGN.md — replaces ReserveService (SPEC.md §40). A
// supplier pays 2% of the sale price into this pool on every confirmed
// delivery. It is DataPay's own revenue, and a share of it is meant to go
// back to the members whose demand earned it — a discretionary reward for
// contribution, decided by DataPay, never a return on a holding and never a
// dividend. Framing matters legally as much as it does in copy: tokens are
// earned and never sold, no member money is pooled here, and nothing is
// invested on anyone's behalf. Sharing isn't built yet (no decided cadence —
// see the design doc's open questions), so this service only tracks what has
// accumulated; it does not invent a fake "your share" number.
//
// The table is still named corpus_fund_ledger — renaming an append-only
// ledger with live production rows is a migration, not a copy change.
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
