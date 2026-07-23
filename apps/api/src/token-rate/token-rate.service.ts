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
   * SPEC.md §6C. realisedSalesVelocity and supplierCompetition both require
   * offers + verified purchases, which don't exist until Phase 4 — 0 here is
   * not a stand-in guess, it's the honest current value: no sales have
   * happened yet, so the rate correctly sits at the floor until they do.
   */
  async computeAndPublish(): Promise<{ ratePaise: number; inputs: TokenRateInputs }> {
    const inputs: TokenRateInputs = {
      demandPressure: await this.computeDemandPressure(),
      realisedSalesVelocity: 0,
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
