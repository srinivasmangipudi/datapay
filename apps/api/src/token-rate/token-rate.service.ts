import { Inject, Injectable } from "@nestjs/common";
import { computeTokenRate, type TokenRateInputs } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

@Injectable()
export class TokenRateService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async computeDemandPressure(): Promise<number> {
    const { rows } = await this.pool.query<{ total: string; active: string }>(
      `SELECT
         (SELECT COUNT(*) FROM members) AS total,
         (SELECT COUNT(DISTINCT alias_id) FROM responses WHERE answered_at > now() - interval '7 days') AS active`
    );
    const total = Number(rows[0].total);
    const active = Number(rows[0].active);
    if (total === 0) return 0;
    return Math.min(1, active / total);
  }

  /**
   * SPEC.md §6C: "fraction of recent declared demand that converted to
   * verified purchases." Recent = last 30 days of declared intent. Verified
   * = the intent's fulfilling offer_participation actually reached
   * 'delivered' (SPEC.md §40 — the same bar realising a token's reserve
   * requires), not just redeemed-but-not-yet-confirmed.
   */
  private async computeRealisedSalesVelocity(): Promise<number> {
    const { rows } = await this.pool.query<{ total: string; verified: string }>(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (
           WHERE i.fulfilled_offer_id IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM offer_participation op
               WHERE op.offer_id = i.fulfilled_offer_id
                 AND op.alias_id = i.alias_id
                 AND op.state = 'delivered'
             )
         ) AS verified
       FROM intents i
       WHERE i.declared_at > now() - interval '30 days'`
    );
    const total = Number(rows[0].total);
    const verified = Number(rows[0].verified);
    return total === 0 ? 0 : verified / total;
  }

  /**
   * SPEC.md §6C. supplierCompetition requires a bidding mechanic — multiple
   * suppliers competing to reach the same demand — which genuinely doesn't
   * exist yet: an offer today has exactly one collective_price_paise, not
   * competing bids. 0 here is still the honest current value, unlike
   * realisedSalesVelocity above, which now has real data to compute from.
   */
  async computeAndPublish(): Promise<{ ratePaise: number; inputs: TokenRateInputs }> {
    const inputs: TokenRateInputs = {
      demandPressure: await this.computeDemandPressure(),
      realisedSalesVelocity: await this.computeRealisedSalesVelocity(),
      supplierCompetition: 0,
    };
    const ratePaise = computeTokenRate(inputs);

    await this.pool.query(`UPDATE token_rate SET effective_to = now() WHERE effective_to IS NULL`);
    await this.pool.query(`INSERT INTO token_rate (rate_paise, inputs) VALUES ($1, $2)`, [
      ratePaise,
      inputs,
    ]);
    return { ratePaise, inputs };
  }

  async current() {
    const { rows } = await this.pool.query(
      `SELECT rate_paise, inputs, computed_at FROM token_rate
       WHERE effective_to IS NULL ORDER BY computed_at DESC LIMIT 1`
    );
    return rows[0] ?? null;
  }

  async history(limit = 50) {
    const { rows } = await this.pool.query(
      `SELECT rate_paise, inputs, computed_at, effective_from, effective_to
       FROM token_rate ORDER BY computed_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }
}
