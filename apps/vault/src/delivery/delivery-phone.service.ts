import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

/**
 * Delivery agents' phone numbers — the directory Core is not allowed to hold.
 *
 * LAW 1 admits no phone into core_db at all, proven on every run by
 * no-phone-in-core.integration.spec.ts, which caught this table's first draft
 * sitting in Core. So Core knows an agent by an opaque uuid and asks here to
 * turn a number into one; this side knows nothing about what an agent covers
 * or delivers.
 */
@Injectable()
export class DeliveryPhoneService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Upsert on agent_id, so correcting a typo re-points rather than duplicates. */
  async register(agentId: string, phoneE164: string): Promise<{ ok: true }> {
    await this.pool.query(
      `INSERT INTO delivery_agent_phones (agent_id, phone_e164) VALUES ($1, $2)
       ON CONFLICT (agent_id) DO UPDATE SET phone_e164 = EXCLUDED.phone_e164`,
      [agentId, phoneE164]
    );
    return { ok: true };
  }

  /** Sign-in's first half: whose number is this? Null when nobody's. */
  async resolveByPhone(phoneE164: string): Promise<{ agentId: string } | null> {
    const { rows } = await this.pool.query<{ agent_id: string }>(
      `SELECT agent_id FROM delivery_agent_phones WHERE phone_e164 = $1`,
      [phoneE164]
    );
    if (!rows[0]) return null;

    await this.pool.query(
      `INSERT INTO vault_access_log (service, purpose, alias_or_token) VALUES ($1, $2, $3)`,
      ["vault", "delivery-signin", rows[0].agent_id]
    );
    return { agentId: rows[0].agent_id };
  }

  /** Batch read for the ops list, so it can show numbers Core never stores. */
  async resolveBatch(agentIds: string[]): Promise<Array<{ agentId: string; phone: string }>> {
    if (agentIds.length === 0) return [];
    const { rows } = await this.pool.query<{ agent_id: string; phone_e164: string }>(
      `SELECT agent_id, phone_e164 FROM delivery_agent_phones WHERE agent_id = ANY($1)`,
      [agentIds]
    );
    await this.pool.query(
      `INSERT INTO vault_access_log (service, purpose, alias_or_token) VALUES ($1, $2, $3)`,
      ["vault", "delivery-phone-batch", `batch:${rows.length}`]
    );
    return rows.map((r) => ({ agentId: r.agent_id, phone: r.phone_e164 }));
  }

  async isTaken(phoneE164: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      `SELECT 1 FROM delivery_agent_phones WHERE phone_e164 = $1`,
      [phoneE164]
    );
    return rows.length > 0;
  }
}
