import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.module";

// §6's velocity cap: PulseService only ever shows 5 unanswered questions a
// day, so 60/24h comfortably covers a week of legitimate offline-sync
// catch-up while still catching a script hammering the endpoint directly.
export const VELOCITY_CAP_PER_24H = 60;
export const TRUST_SCORE_CONTRADICTION_PENALTY = 0.05;
export const TRUST_SCORE_VERIFICATION_BONUS = 0.05;
export const TRUST_SCORE_PAYOUT_REVIEW_THRESHOLD = 0.5;
const CONTRADICTION_WINDOW_HOURS = 24;

export type QualityFlagRule = "velocity_cap" | "intent_contradiction" | "device_dedup";

// SPEC.md §6 "Fraud/quality engine": consistency scoring, velocity caps,
// hashed device-fingerprint dedup, verification bonus — all landing in
// `quality_flags` + `members.trust_score`, never a silent block or
// confiscation. Every check here runs inside the caller's own transaction,
// same discipline as LedgerService (§15A).
@Injectable()
export class FraudService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async flag(client: PoolClient, aliasId: string, rule: QualityFlagRule, detail: string): Promise<void> {
    await client.query(
      `INSERT INTO quality_flags (alias_id, rule, detail) VALUES ($1, $2, $3)`,
      [aliasId, rule, detail]
    );
  }

  async adjustTrustScore(client: PoolClient, aliasId: string, delta: number): Promise<void> {
    await client.query(
      `UPDATE members SET trust_score = GREATEST(0, LEAST(1, trust_score + $1)) WHERE alias_id = $2`,
      [delta, aliasId]
    );
  }

  /**
   * Real enforcement, not just logging: throws once an alias crosses the cap,
   * so the caller's transaction rolls back and the response is never stored.
   * Counted against `created_at` (server time), never `answered_at` (client-
   * supplied and legitimately backdated by the offline outbox).
   *
   * The flag itself is written on a SEPARATE connection, not `client` — the
   * caller's transaction is about to roll back (that's the whole point), and
   * a flag written on `client` would roll back with it, silently erasing the
   * one record of why the request was rejected.
   */
  async enforceVelocityCap(client: PoolClient, aliasId: string): Promise<void> {
    const { rows } = await client.query<{ count: string }>(
      `SELECT count(*) FROM responses WHERE alias_id = $1 AND created_at > now() - interval '24 hours'`,
      [aliasId]
    );
    const count = Number(rows[0].count);
    if (count >= VELOCITY_CAP_PER_24H) {
      await this.pool.query(
        `INSERT INTO quality_flags (alias_id, rule, detail) VALUES ($1, 'velocity_cap', $2)`,
        [aliasId, `${count} responses in the last 24h`]
      );
      throw new VelocityCapExceededError(aliasId, count);
    }
  }

  /**
   * A member declaring conflicting strength ('yes' then 'maybe', or vice
   * versa) for the same category within a short window is either confused or
   * gaming the per-answer token reward — either way it's a signal, not a
   * block. Flags + a small trust_score decrement; the intent row itself is
   * still recorded (never silently dropped).
   */
  async checkIntentConsistency(
    client: PoolClient,
    aliasId: string,
    categoryId: number,
    strength: string
  ): Promise<void> {
    const { rows } = await client.query<{ id: number }>(
      `SELECT id FROM intents
       WHERE alias_id = $1 AND product_category_id = $2 AND strength != $3
         AND declared_at > now() - interval '${CONTRADICTION_WINDOW_HOURS} hours'
       LIMIT 1`,
      [aliasId, categoryId, strength]
    );
    if (rows[0]) {
      await this.flag(
        client,
        aliasId,
        "intent_contradiction",
        `category ${categoryId}: declared '${strength}' within ${CONTRADICTION_WINDOW_HOURS}h of a conflicting declaration`
      );
      await this.adjustTrustScore(client, aliasId, -TRUST_SCORE_CONTRADICTION_PENALTY);
    }
  }

  /**
   * Hashed core-side (SHA-256) — the raw fingerprint the client sends never
   * touches storage, and this table has no path to a phone number (LAW 1).
   * If the same hash is already registered under a DIFFERENT alias, that's
   * the multi-accounting signal; both aliases get flagged, neither blocked.
   */
  async recordDeviceFingerprint(client: PoolClient, aliasId: string, rawFingerprint: string): Promise<void> {
    const hash = createHash("sha256").update(rawFingerprint).digest("hex");

    await client.query(
      `INSERT INTO device_fingerprints (alias_id, fingerprint_hash)
       VALUES ($1, $2)
       ON CONFLICT (alias_id, fingerprint_hash) DO UPDATE SET last_seen_at = now()`,
      [aliasId, hash]
    );

    const { rows: otherAliases } = await client.query<{ alias_id: string }>(
      `SELECT DISTINCT alias_id FROM device_fingerprints WHERE fingerprint_hash = $1 AND alias_id != $2`,
      [hash, aliasId]
    );
    if (otherAliases.length > 0) {
      await this.flag(
        client,
        aliasId,
        "device_dedup",
        `fingerprint shared with ${otherAliases.length} other alias(es)`
      );
      for (const other of otherAliases) {
        await this.flag(
          client,
          other.alias_id,
          "device_dedup",
          `fingerprint shared with alias ${aliasId}`
        );
      }
    }
  }
}

export class VelocityCapExceededError extends Error {
  constructor(
    public readonly aliasId: string,
    public readonly count: number
  ) {
    super(`Alias ${aliasId} exceeded the velocity cap: ${count} responses in 24h`);
  }
}
