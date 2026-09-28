import { Inject, Injectable, Logger } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { PushSender, resolvePushSender } from "./push-sender.provider";

/**
 * The morning nudge: "you have questions waiting".
 *
 * Core decides WHO — it alone knows who has unanswered questions — and Vault
 * resolves those aliases to devices. Core never stores a push token, the same
 * way it never stores a UPI ID or an address.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly sender: PushSender = resolvePushSender();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Aliases with at least one servable, unanswered question right now.
   *
   * Mirrors PulseService's eligibility rules exactly — zone scoping, the
   * option-less-question guard, already-answered retirement, and the consent
   * off-switch. A nudge that leads to an empty Pulse screen is worse than no
   * nudge, so the two must not drift; the shared conditions are why this is a
   * single EXISTS rather than a per-member call into the pulse query.
   */
  async membersWithPendingQuestions(): Promise<string[]> {
    const { rows } = await this.pool.query<{ alias_id: string }>(
      `WITH RECURSIVE zone_chain AS (
         SELECT m.alias_id, z.id, z.parent_id FROM members m JOIN zones z ON z.id = m.zone_id
         UNION ALL
         SELECT c.alias_id, z.id, z.parent_id FROM zones z JOIN zone_chain c ON z.id = c.parent_id
       )
       SELECT m.alias_id
         FROM members m
        WHERE m.status = 'active'
          AND EXISTS (
            SELECT 1 FROM questions q
             WHERE q.review_state = 'approved'
               AND q.active_from <= now()
               AND (q.active_to IS NULL OR q.active_to > now())
               AND (q.zone_id IS NULL
                    OR q.zone_id IN (SELECT id FROM zone_chain WHERE alias_id = m.alias_id))
               AND (
                 q.type NOT IN ('single', 'multi', 'yesno', 'intent_window')
                 OR EXISTS (SELECT 1 FROM question_options qo WHERE qo.question_id = q.id)
               )
               AND NOT EXISTS (
                 SELECT 1 FROM responses r WHERE r.question_id = q.id AND r.alias_id = m.alias_id
               )
               AND NOT EXISTS (
                 SELECT 1 FROM consents co
                  WHERE co.category_id = q.category_id
                    AND co.alias_id = m.alias_id
                    AND co.granted = false
               )
          )`
    );
    return rows.map((r) => r.alias_id);
  }

  /** Registers this device against the caller's alias — proxied straight to
      Vault, never stored in core_db. */
  async registerToken(
    aliasId: string,
    token: string,
    platform: "android" | "ios"
  ): Promise<{ ok: true }> {
    const vaultUrl = process.env.VAULT_INTERNAL_URL;
    if (!vaultUrl) throw new Error("Missing VAULT_INTERNAL_URL");
    const res = await fetch(`${vaultUrl}/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliasId, token, platform }),
    });
    if (!res.ok) throw new Error(`Vault rejected push-token register (HTTP ${res.status})`);
    return { ok: true };
  }

  /** Vault resolves aliases to devices; Core never sees a token outside this call. */
  private async resolveTokens(
    aliasIds: string[]
  ): Promise<Array<{ aliasId: string; token: string }>> {
    const vaultUrl = process.env.VAULT_INTERNAL_URL;
    if (!vaultUrl) throw new Error("Missing VAULT_INTERNAL_URL");

    const out: Array<{ aliasId: string; token: string }> = [];
    // Chunked to keep one enormous batch off both the wire and Vault's query
    // planner; the DTO caps a batch at 1000 anyway.
    for (let i = 0; i < aliasIds.length; i += 500) {
      const chunk = aliasIds.slice(i, i + 500);
      const res = await fetch(`${vaultUrl}/resolve-push-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aliasIds: chunk }),
      });
      if (!res.ok) throw new Error(`Vault rejected push-token resolve (HTTP ${res.status})`);
      out.push(...((await res.json()) as Array<{ aliasId: string; token: string }>));
    }
    return out;
  }

  async removeToken(token: string): Promise<void> {
    const vaultUrl = process.env.VAULT_INTERNAL_URL;
    if (!vaultUrl) return;
    await fetch(`${vaultUrl}/push-token/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => undefined);
  }

  /**
   * One pass of the morning nudge. Returns counts rather than anything
   * member-identifying, so the result is safe to log and to show ops.
   */
  async sendPendingQuestionNudge(): Promise<{
    candidates: number;
    devices: number;
    sent: number;
    failed: number;
    pruned: number;
  }> {
    const aliasIds = await this.membersWithPendingQuestions();
    if (aliasIds.length === 0) {
      return { candidates: 0, devices: 0, sent: 0, failed: 0, pruned: 0 };
    }

    const devices = await this.resolveTokens(aliasIds);
    let sent = 0;
    let failed = 0;
    let pruned = 0;

    for (const d of devices) {
      const result = await this.sender.send(d.token, {
        title: "Today's Pulse is ready",
        body: "A few quick questions — answer and earn tokens.",
      });
      if (result.ok) {
        sent += 1;
      } else if (result.unregistered) {
        // The app was uninstalled or FCM rotated the token. Drop it rather
        // than retrying it every morning forever.
        await this.removeToken(d.token);
        pruned += 1;
      } else {
        failed += 1;
      }
    }

    this.logger.log(
      `push nudge: candidates=${aliasIds.length} devices=${devices.length} sent=${sent} failed=${failed} pruned=${pruned}`
    );
    return { candidates: aliasIds.length, devices: devices.length, sent, failed, pruned };
  }
}
