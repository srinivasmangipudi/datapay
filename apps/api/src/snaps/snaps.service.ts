import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { SnapDto } from "@datapay/shared";
import { Pool } from "pg";
import { AuditService } from "../audit/audit.service";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
import { FraudService, TRUST_SCORE_VERIFICATION_BONUS } from "../fraud/fraud.service";
import { LedgerService } from "../ledger/ledger.service";
import { DevNoopStorageProvider, StorageProvider } from "./storage.provider";
import { DevNoopVisionProvider, GeminiVisionProvider, VisionProvider } from "./vision.provider";

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
  private visionInstance: VisionProvider | null = null;
  // Test-only seam — same shape as TranslationService.translationOverride.
  recognitionOverride: VisionProvider | null = null;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly ledger: LedgerService,
    private readonly fraud: FraudService,
    private readonly audit: AuditService
  ) {}

  private get vision(): VisionProvider {
    if (this.recognitionOverride) return this.recognitionOverride;
    if (!this.visionInstance) {
      try {
        this.visionInstance = new GeminiVisionProvider();
      } catch {
        // No GEMINI_API_KEY configured — recognition is enrichment, not a
        // gate on the reward, so this degrades to "no tags" rather than
        // blocking snap submission entirely.
        this.visionInstance = new DevNoopVisionProvider();
      }
    }
    return this.visionInstance;
  }

  async submit(aliasId: string, dto: SnapDto) {
    // On-device EXIF-strip + face-check already happened client-side (SPEC.md §8.4)
    // before this ever reaches the network — this endpoint trusts that contract.
    const { storageKey } = await this.storage.store(dto.imageBase64);

    const result = await withTransaction(this.pool, async (client) => {
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

    // Recognition runs after the reward is already committed — a member's
    // tokens never depend on whether Gemini managed to tag the photo. Best
    // effort: this is ops-assist for the verification queue (SPEC.md §32),
    // not a claim checked before paying out.
    if (result.status === "credited") {
      this.recognize(result.snapId, dto.imageBase64).catch((err) => {
        console.error(`Snap ${result.snapId} recognition failed:`, (err as Error).message);
      });
    }

    return result;
  }

  private async recognize(snapId: number, imageBase64: string): Promise<void> {
    const { rows: categories } = await this.pool.query<{ slug: string; name: string }>(
      `SELECT slug, name FROM categories ORDER BY id`
    );
    const { tags, label, confidence, productGuess, categorySlug } = await this.vision.analyze(
      imageBase64,
      categories
    );
    if (tags.length === 0 && !label) return; // dev-noop or an empty/failed read — nothing to save

    const { rows: categoryRows } = categorySlug
      ? await this.pool.query<{ id: number }>(`SELECT id FROM categories WHERE slug = $1`, [categorySlug])
      : { rows: [] as { id: number }[] };

    await this.pool.query(
      `UPDATE snaps
       SET state = 'recognized', recognized_tags = $1, recognized_label = $2,
           recognized_confidence = $3, recognized_at = now(),
           recognized_product_guess = $4, recognized_category_id = $5
       WHERE id = $6 AND state = 'uploaded'`,
      [tags, label, confidence, productGuess, categoryRows[0]?.id ?? null, snapId]
    );
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
   * `recognized*` fields are Gemini's own guess (SPEC.md §32) — ops-assist
   * only, shown alongside the member-declared `categoryId`, never merged
   * into it.
   */
  async listAll(state?: string) {
    const { rows } = await this.pool.query<
      SnapRow & {
        alias_id: string;
        storage_key: string;
        category_id: number | null;
        recognized_tags: string[] | null;
        recognized_label: string | null;
        recognized_confidence: string | null;
        recognized_product_guess: string | null;
        recognized_category_name: string | null;
      }
    >(
      `SELECT s.id, s.alias_id, s.state, s.storage_key, s.category_id, s.reward_tokens,
              s.captured_at, s.product_code, s.recognized_tags, s.recognized_label,
              s.recognized_confidence, s.recognized_product_guess, rc.name AS recognized_category_name
       FROM snaps s
       LEFT JOIN categories rc ON rc.id = s.recognized_category_id
       ${state ? "WHERE s.state = $1" : ""}
       ORDER BY s.captured_at DESC`,
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
      recognizedTags: s.recognized_tags ?? [],
      recognizedLabel: s.recognized_label,
      recognizedConfidence: s.recognized_confidence ? Number(s.recognized_confidence) : null,
      recognizedProductGuess: s.recognized_product_guess,
      recognizedCategoryName: s.recognized_category_name,
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
