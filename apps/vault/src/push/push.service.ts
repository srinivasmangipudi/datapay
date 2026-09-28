import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

/**
 * Device push tokens — the same category as phone numbers, delivery addresses
 * and payout instruments: how to REACH a person. Core never holds one.
 *
 * Core decides who to notify (it alone knows who has unanswered questions) and
 * calls resolveBatch with aliases; this returns tokens and nothing else. Same
 * shape as PayoutService.resolvePayoutBatch, deliberately.
 */
@Injectable()
export class PushService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async resolveUserId(aliasId: string): Promise<string> {
    const { rows } = await this.pool.query<{ user_id: string }>(
      `SELECT user_id FROM alias_map WHERE alias_id = $1`,
      [aliasId]
    );
    if (!rows[0]) throw new NotFoundException("Unknown alias");
    return rows[0].user_id;
  }

  /**
   * Upsert on the token, not the user: one person may have several devices,
   * and FCM can hand the same token to a different install later. Re-pointing
   * an existing token at whoever holds it now is the correct behaviour — the
   * alternative is notifying the wrong phone.
   */
  async register(aliasId: string, token: string, platform: "android" | "ios"): Promise<{ ok: true }> {
    const userId = await this.resolveUserId(aliasId);
    await this.pool.query(
      `INSERT INTO push_tokens (token, user_id, platform) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             platform = EXCLUDED.platform,
             last_seen_at = now()`,
      [token, userId, platform]
    );
    return { ok: true };
  }

  /** Called on logout, and whenever FCM tells us a token is dead. */
  async remove(token: string): Promise<{ ok: true }> {
    await this.pool.query(`DELETE FROM push_tokens WHERE token = $1`, [token]);
    return { ok: true };
  }

  /**
   * Batch, never a live per-member lookup — the same discipline resolvePayoutBatch
   * follows. Aliases with no device registered are silently omitted rather than
   * errored: not having the app installed is normal, not a failure.
   */
  async resolveBatch(aliasIds: string[]): Promise<Array<{ aliasId: string; token: string; platform: string }>> {
    if (aliasIds.length === 0) return [];

    const { rows } = await this.pool.query<{
      alias_id: string;
      token: string;
      platform: string;
    }>(
      `SELECT am.alias_id, pt.token, pt.platform
         FROM push_tokens pt
         JOIN alias_map am ON am.user_id = pt.user_id
        WHERE am.alias_id = ANY($1)`,
      [aliasIds]
    );

    if (rows.length > 0) {
      await this.pool.query(
        `INSERT INTO vault_access_log (service, purpose, alias_or_token) VALUES ($1, $2, $3)`,
        ["vault", "resolve-push-tokens", `batch:${rows.length}`]
      );
    }

    return rows.map((r) => ({ aliasId: r.alias_id, token: r.token, platform: r.platform }));
  }
}
