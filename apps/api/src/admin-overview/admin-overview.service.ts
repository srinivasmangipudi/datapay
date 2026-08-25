import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { CorpusFundService } from "../corpus-fund/corpus-fund.service";

// TOKEN_ECONOMY_REDESIGN.md — the "main company page" numbers, simplified.
// Every token is equal now (no issued/realised split, replacing SPEC.md
// §40 in full): how many members, how many tokens exist in total, and how
// much has accumulated in the corpus fund so far. No "current token price"
// is published here anymore — that would require actual distributed
// investment returns, which don't exist yet (the corpus isn't invested,
// there's no decided distribution cadence — see TOKEN_ECONOMY_REDESIGN.md's
// open questions). Showing a number here would be inventing one.
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
