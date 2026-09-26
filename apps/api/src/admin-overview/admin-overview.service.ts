import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { CorpusFundService } from "../corpus-fund/corpus-fund.service";

// TOKEN_ECONOMY_REDESIGN.md — the "main company page" numbers, simplified.
// Every token is equal now (no issued/realised split, replacing SPEC.md
// §40 in full): how many members, how many tokens exist in total, and how
// much has accumulated in the reward pool so far. Deliberately no "current
// token price" and no per-member rupee figure: a token has no promised cash
// value, and publishing one would read as a rate of return on something
// members hold, which is exactly what this isn't. Any sharing out of the
// pool is DataPay's discretionary reward for contribution, and it isn't
// built yet (no decided cadence — see TOKEN_ECONOMY_REDESIGN.md's open
// questions), so any number here would be an invented one.
@Injectable()
export class AdminOverviewService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly corpusFund: CorpusFundService
  ) {}

  async getOverview() {
    const [memberRows, tokenRows, corpusTotal] = await Promise.all([
      this.pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM members`),
      this.pool.query<{ total: string }>(
        `SELECT COALESCE(SUM(token_balance), 0) AS total FROM members`
      ),
      this.corpusFund.getTotal(),
    ]);

    return {
      totalMembers: Number(memberRows.rows[0].total),
      totalTokens: Number(tokenRows.rows[0].total),
      corpusFundPaise: corpusTotal.corpusPaise,
    };
  }
}
