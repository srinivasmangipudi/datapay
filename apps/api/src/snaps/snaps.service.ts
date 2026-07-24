import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { SnapDto } from "@datapay/shared";
import { Pool } from "pg";
import { AuditService } from "../audit/audit.service";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
import { FraudService, TRUST_SCORE_VERIFICATION_BONUS } from "../fraud/fraud.service";
import { LedgerService } from "../ledger/ledger.service";
import { DevNoopStorageProvider, StorageProvider } from "./storage.provider";

interface SnapRow {
  id: number;
  state: string;
  reward_tokens: number;
  captured_at: Date;
  product_code: string | null;
}

@Injectable()
export class SnapsService {
  private readonly storage: StorageProvider = new DevNoopStorageProvider();

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly ledger: LedgerService,
    private readonly fraud: FraudService,
    private readonly audit: AuditService
  ) {}

  async submit(aliasId: string, dto: SnapDto) {
    // On-device EXIF-strip + face-check already happened client-side (SPEC.md §8.4)
    // before this ever reaches the network — this endpoint trusts that contract.
    const { storageKey } = await this.storage.store(dto.imageBase64);

    return withTransaction(this.pool, async (client) => {
      const { rows: inserted } = await client.query<{ id: number; reward_tokens: number }>(
        `INSERT INTO snaps (alias_id, storage_key, category_id, client_msg_id, captured_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (client_msg_id) DO NOTHING
         RETURNING id, reward_tokens`,
        [aliasId, storageKey, dto.categoryId ?? null, dto.clientMsgId, dto.capturedAt]
      );

      if (!inserted[0]) {
        return { status: "already_synced" as const };
      }

      await this.ledger.creditTokens({
        client,
        aliasId,
        entry: "earn_snap",
        tokens: inserted[0].reward_tokens,
        refType: "snap",
        refId: inserted[0].id,
      });

      return { status: "credited" as const, snapId: inserted[0].id };
    });
  }

  /**
   * §6's "verification bonus": ops confirms a snap is real (the
   * `uploaded → recognized → member_confirmed → ops_verified` chain SPEC.md
   * §8.4 describes was never wired to an endpoint until now) and the
   * member's trust_score ticks up. Only a snap not already in a terminal
   * state can be verified — verifying twice, or verifying a rejected snap,
   * is rejected rather than silently double-crediting trust.
   */
  async verify(snapId: number): Promise<{ aliasId: string; trustScoreBonus: number }> {
    return withTransaction(this.pool, async (client) => {
      const { rows } = await client.query<{ alias_id: string; state: string }>(
        `SELECT alias_id, state FROM snaps WHERE id = $1 FOR UPDATE`,
        [snapId]
      );
      if (!rows[0]) throw new NotFoundException("Snap not found");
      if (rows[0].state === "ops_verified" || rows[0].state === "rejected") {
        throw new BadRequestException(`Snap is already '${rows[0].state}'`);
      }

      await client.query(
        `UPDATE snaps SET state = 'ops_verified', verified_at = now() WHERE id = $1`,
        [snapId]
      );
      await this.fraud.adjustTrustScore(client, rows[0].alias_id, TRUST_SCORE_VERIFICATION_BONUS);
      await this.audit.record("admin", null, "verify_snap", `snap:${snapId}`, client);

      return { aliasId: rows[0].alias_id, trustScoreBonus: TRUST_SCORE_VERIFICATION_BONUS };
    });
  }

  async list(aliasId: string) {
    const { rows } = await this.pool.query<SnapRow>(
      `SELECT id, state, reward_tokens, captured_at, product_code FROM snaps
       WHERE alias_id = $1 ORDER BY captured_at DESC`,
      [aliasId]
    );
    return rows.map((s) => ({
      id: s.id,
      state: s.state,
      rewardTokens: s.reward_tokens,
      capturedAt: s.captured_at,
      productCode: s.product_code,
    }));
  }

  /**
   * Ops-wide view across every member's snaps, optionally filtered to one
   * state — the verification queue's list endpoint. `storage_key` is
   * included as-is: still a dev-stub reference until real blob storage is
   * wired up (see storage.provider.ts), never a real image URL yet.
   */
  async listAll(state?: string) {
    const { rows } = await this.pool.query<
      SnapRow & { alias_id: string; storage_key: string; category_id: number | null }
    >(
      state
        ? `SELECT id, alias_id, state, storage_key, category_id, reward_tokens, captured_at, product_code
           FROM snaps WHERE state = $1 ORDER BY captured_at DESC`
        : `SELECT id, alias_id, state, storage_key, category_id, reward_tokens, captured_at, product_code
           FROM snaps ORDER BY captured_at DESC`,
      state ? [state] : []
    );
    return rows.map((s) => ({
      id: s.id,
      aliasId: s.alias_id,
      state: s.state,
      storageKey: s.storage_key,
      categoryId: s.category_id,
      rewardTokens: s.reward_tokens,
      capturedAt: s.captured_at,
      productCode: s.product_code,
    }));
  }

  /**
   * The other half of the uploaded→ops_verified fork — a snap ops decides
   * isn't real evidence. No trust-score penalty here (only verification
   * grants a bonus, §6) — rejecting just closes the item out of the queue.
   */
  async reject(snapId: number): Promise<{ aliasId: string }> {
    return withTransaction(this.pool, async (client) => {
      const { rows } = await client.query<{ alias_id: string; state: string }>(
        `SELECT alias_id, state FROM snaps WHERE id = $1 FOR UPDATE`,
        [snapId]
      );
      if (!rows[0]) throw new NotFoundException("Snap not found");
      if (rows[0].state === "ops_verified" || rows[0].state === "rejected") {
        throw new BadRequestException(`Snap is already '${rows[0].state}'`);
      }

      await client.query(`UPDATE snaps SET state = 'rejected' WHERE id = $1`, [snapId]);
      await this.audit.record("admin", null, "reject_snap", `snap:${snapId}`, client);

      return { aliasId: rows[0].alias_id };
    });
  }
}
