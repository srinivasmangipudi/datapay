import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { DevSandboxUpiProvider, type UpiProvider } from "./upi-provider";

const UPI_PROVIDER: UpiProvider = new DevSandboxUpiProvider();

@Injectable()
export class ProducerPayoutsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Pays out every agreed/completed linkage that hasn't been paid yet.
   * Idempotency comes from the DB, not app logic: the claiming INSERT uses
   * ON CONFLICT (linkage_id) DO NOTHING, so re-running this job never double
   * pays — a second run simply inserts zero rows for anything already claimed.
   */
  async runPayouts() {
    const { rows: candidates } = await this.pool.query<{
      linkage_id: number;
      alias_id: string;
      amount_paise: number;
    }>(
      `SELECT l.id AS linkage_id, pl.alias_id, l.proposed_price_paise AS amount_paise
       FROM linkages l
       JOIN produce_listings pl ON pl.id = l.listing_id
       LEFT JOIN producer_payouts pp ON pp.linkage_id = l.id
       WHERE l.state IN ('agreed', 'completed') AND pp.id IS NULL`
    );

    let paid = 0;
    let failed = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      const { rows: claimed } = await this.pool.query<{ id: number }>(
        `INSERT INTO producer_payouts (alias_id, linkage_id, amount_paise, status)
         VALUES ($1, $2, $3, 'processing')
         ON CONFLICT (linkage_id) DO NOTHING
         RETURNING id`,
        [candidate.alias_id, candidate.linkage_id, candidate.amount_paise]
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

    return { candidates: candidates.length, paid, failed, skipped };
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
