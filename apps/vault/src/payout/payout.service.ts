import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { decryptSecret, encryptSecret } from "../crypto/secret-crypto.util";

@Injectable()
export class PayoutService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async resolveUserId(aliasId: string): Promise<string> {
    const { rows } = await this.pool.query<{ user_id: string }>(
      `SELECT user_id FROM alias_map WHERE alias_id = $1`,
      [aliasId]
    );
    if (!rows[0]) throw new NotFoundException("Unknown alias");
    return rows[0].user_id;
  }

  async setPayoutInstrument(aliasId: string, upiId: string): Promise<{ ok: true }> {
    const userId = await this.resolveUserId(aliasId);
    await this.pool.query(
      `INSERT INTO payout_instruments (user_id, upi_id_encrypted) VALUES ($1, $2)`,
      [userId, encryptSecret(upiId)]
    );
    return { ok: true };
  }

  /**
   * SPEC.md §5A's fourth original endpoint, finally needed: producers only,
   * always a batch (never a single live lookup mid-checkout), resolved at
   * payout execution time. Aliases with no instrument on file are silently
   * omitted, not errored — a partial batch is normal (not every producer has
   * registered a UPI ID yet).
   */
  async resolvePayoutBatch(aliasIds: string[]): Promise<{ aliasId: string; upiId: string }[]> {
    const results: { aliasId: string; upiId: string }[] = [];
    for (const aliasId of aliasIds) {
      const { rows: aliasRows } = await this.pool.query<{ user_id: string }>(
        `SELECT user_id FROM alias_map WHERE alias_id = $1`,
        [aliasId]
      );
      if (!aliasRows[0]) continue;

      const { rows: instrumentRows } = await this.pool.query<{ upi_id_encrypted: string }>(
        `SELECT upi_id_encrypted FROM payout_instruments WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [aliasRows[0].user_id]
      );
      if (!instrumentRows[0]) continue;

      results.push({ aliasId, upiId: decryptSecret(instrumentRows[0].upi_id_encrypted) });
    }

    if (results.length > 0) {
      await this.pool.query(
        `INSERT INTO vault_access_log (service, purpose, alias_or_token) VALUES ($1, $2, $3)`,
        ["vault", "resolve-payout", `batch:${results.length}`]
      );
    }

    return results;
  }

  /**
   * Records what the payment provider said about one executed payout. Lives
   * here rather than in core.producer_payouts because the reference is a join
   * key into records that know the beneficiary's bank account — see the
   * migration comment on payout_refs.
   *
   * Idempotent on payout_id: a retried payout run re-reports the same result
   * rather than erroring, matching the ON CONFLICT (linkage_id) discipline the
   * Core side of the same run already uses.
   */
  async recordPayoutRef(payoutId: number, status: string, upiRef: string | null): Promise<{ ok: true }> {
    await this.pool.query(
      `INSERT INTO payout_refs (payout_id, upi_ref, status) VALUES ($1, $2, $3)
       ON CONFLICT (payout_id) DO UPDATE SET upi_ref = EXCLUDED.upi_ref, status = EXCLUDED.status`,
      [payoutId, upiRef, status]
    );
    return { ok: true };
  }

  /** Batch read for reconciliation — the only way back out, same shape as
      resolvePayoutBatch so neither becomes a live per-record lookup. */
  async resolvePayoutRefs(payoutIds: number[]): Promise<{ payoutId: number; status: string; upiRef: string | null }[]> {
    if (payoutIds.length === 0) return [];
    const { rows } = await this.pool.query<{ payout_id: number; status: string; upi_ref: string | null }>(
      `SELECT payout_id, status, upi_ref FROM payout_refs WHERE payout_id = ANY($1)`,
      [payoutIds]
    );
    await this.pool.query(
      `INSERT INTO vault_access_log (service, purpose, alias_or_token) VALUES ($1, $2, $3)`,
      ["vault", "resolve-payout-refs", `batch:${rows.length}`]
    );
    return rows.map((r) => ({ payoutId: r.payout_id, status: r.status, upiRef: r.upi_ref }));
  }
}
