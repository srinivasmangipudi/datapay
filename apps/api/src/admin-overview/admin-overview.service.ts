import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { ReserveService } from "../reserve/reserve.service";
import { TokenRateService } from "../token-rate/token-rate.service";

// SPEC.md §40 — the "main company page" numbers: how many members, how many
// tokens are still outstanding (an unbacked liability, members.token_balance)
// vs. realised (redeemed AND delivered — actually backed, SPEC.md §40), how
// much real currency is reserved against that realised amount, and the
// current published rate. Every number here is a straight aggregate read —
// no new business logic lives in this service, it only reports what
// LedgerService/ReserveService/TokenRateService already recorded.
@Injectable()
export class AdminOverviewService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly reserve: ReserveService,
    private readonly tokenRate: TokenRateService
  ) {}

  async getOverview() {
    const [memberRows, tokenRows, reserveTotal, currentRate] = await Promise.all([
      this.pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM members`),
      // "Realised" here means the SPEC.md §40 bar, not just redeemed: a
      // member can redeem tokens joining an offer before it's delivered
      // (offers.service.ts's join()) — those are still outstanding-in-spirit
      // (spent, but not yet backed by a real reserved rupee) until
      // confirm-delivery actually credits the reserve for them.
      this.pool.query<{ outstanding: string; realised: string }>(
        `SELECT
           (SELECT COALESCE(SUM(token_balance), 0) FROM members) AS outstanding,
           (SELECT COALESCE(SUM(tokens_redeemed), 0) FROM offer_participation WHERE state = 'delivered') AS realised`
      ),
      this.reserve.getTotal(),
      this.tokenRate.current(),
    ]);

    return {
      totalMembers: Number(memberRows.rows[0].total),
      outstandingTokens: Number(tokenRows.rows[0].outstanding),
      realisedTokens: Number(tokenRows.rows[0].realised),
      reservedPaise: reserveTotal.reservedPaise,
      currentTokenRatePaise: currentRate ? Number(currentRate.rate_paise) : null,
      tokenRateComputedAt: currentRate ? currentRate.computed_at : null,
    };
  }
}
