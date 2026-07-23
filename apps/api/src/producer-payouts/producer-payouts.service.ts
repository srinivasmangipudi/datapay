import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { AuditService } from "../audit/audit.service";
import { PG_POOL } from "../db/db.module";
import { TRUST_SCORE_PAYOUT_REVIEW_THRESHOLD } from "../fraud/fraud.service";
import { DevSandboxUpiProvider, type UpiProvider } from "./upi-provider";

const UPI_PROVIDER: UpiProvider = new DevSandboxUpiProvider();

@Injectable()
export class ProducerPayoutsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService
  ) {}

  /**
   * Pays out every agreed/completed linkage that hasn't been paid yet.
   * Idempotency comes from the DB, not app logic: the claiming INSERT uses
   * ON CONFLICT (linkage_id) DO NOTHING, so re-running this job never double
   * pays — a second run simply inserts zero rows for anything already claimed.
   * Every row this run touches shares one batch_id (§19B) — a run IS a batch.
   */
  async runPayouts() {
    const batchId = randomUUID();
    const { rows: candidates } = await this.pool.query<{
      linkage_id: number;
      alias_id: string;
      amount_paise: number;
      trust_score: string;
    }>(
      `SELECT l.id AS linkage_id, pl.alias_id, l.proposed_price_paise AS amount_paise, m.trust_score
       FROM linkages l
       JOIN produce_listings pl ON pl.id = l.listing_id
       JOIN members m ON m.alias_id = pl.alias_id
       LEFT JOIN producer_payouts pp ON pp.linkage_id = l.id
       WHERE l.state IN ('agreed', 'completed') AND pp.id IS NULL`
    );

    let paid = 0;
    let failed = 0;
    let skipped = 0;
    let review = 0;

    for (const candidate of candidates) {
      // §6/§19C: trust-weighted eligibility — a low-trust producer's payout
      // is held for human review, never auto-paid AND never silently
      // dropped. The claim itself still uses ON CONFLICT DO NOTHING, so this
      // status is set exactly once, same as every other outcome below.
      if (Number(candidate.trust_score) < TRUST_SCORE_PAYOUT_REVIEW_THRESHOLD) {
        const { rows: claimed } = await this.pool.query<{ id: number }>(
          `INSERT INTO producer_payouts (alias_id, linkage_id, amount_paise, status, batch_id)
           VALUES ($1, $2, $3, 'review', $4)
           ON CONFLICT (linkage_id) DO NOTHING
           RETURNING id`,
          [candidate.alias_id, candidate.linkage_id, candidate.amount_paise, batchId]
        );
        if (claimed[0]) review += 1;
        else skipped += 1;
        continue;
      }

      const { rows: claimed } = await this.pool.query<{ id: number }>(
        `INSERT INTO producer_payouts (alias_id, linkage_id, amount_paise, status, batch_id)
         VALUES ($1, $2, $3, 'processing', $4)
         ON CONFLICT (linkage_id) DO NOTHING
         RETURNING id`,
        [candidate.alias_id, candidate.linkage_id, candidate.amount_paise, batchId]
      );
      if (!claimed[0]) {
        skipped += 1;
        continue;
      }
      const payoutId = claimed[0].id;

      const upi = await this.resolveUpi(candidate.alias_id);
      if (!upi) {
        await this.pool.query(`UPDATE producer_payouts SET status = 'failed' WHERE id = $1`, [
          payoutId,
        ]);
        failed += 1;
        continue;
      }

      const result = await UPI_PROVIDER.payout(upi, candidate.amount_paise);
      await this.pool.query(
        `UPDATE producer_payouts SET status = $1, upi_ref = $2 WHERE id = $3`,
        [result.ok ? "paid" : "failed", result.reference, payoutId]
      );
      if (result.ok) paid += 1;
      else failed += 1;
    }

    await this.audit.record(
      "system",
      null,
      "run_producer_payouts",
      `batch:${batchId} candidates:${candidates.length} paid:${paid} review:${review}`
    );

    return { batchId, candidates: candidates.length, paid, failed, skipped, review };
  }

  private async resolveUpi(aliasId: string): Promise<string | null> {
    const vaultUrl = process.env.VAULT_INTERNAL_URL;
    if (!vaultUrl) throw new Error("Missing VAULT_INTERNAL_URL");
    const res = await fetch(`${vaultUrl}/resolve-payout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliasIds: [aliasId] }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { aliasId: string; upiId: string }[];
    return data[0]?.upiId ?? null;
  }
}
