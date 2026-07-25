import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PulseAnswerDto } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
import { FraudService, VelocityCapExceededError } from "../fraud/fraud.service";
import { LedgerService } from "../ledger/ledger.service";
import { DevNoopStorageProvider, StorageProvider } from "../snaps/storage.provider";
import { DevNoopVisionProvider, GeminiVisionProvider, VisionProvider } from "../snaps/vision.provider";
import { ZoneResolverService } from "../zones/zone-resolver.service";

const PULSE_BATCH_SIZE = 5;

interface QuestionRow {
  id: number;
  category_id: number;
  type: string;
  text_en: string;
  text_hi: string | null;
  text_local: string | null;
  reward_tokens: number;
  allow_photo: boolean;
  allow_voice: boolean;
  options: { id: number; labelEn: string; labelKn: string | null; sort: number }[];
}

@Injectable()
export class PulseService {
  private readonly storage: StorageProvider = new DevNoopStorageProvider();
  private visionInstance: VisionProvider | null = null;
  // Test-only seam — same shape as SnapsService.recognitionOverride.
  recognitionOverride: VisionProvider | null = null;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly ledger: LedgerService,
    private readonly fraud: FraudService,
    private readonly zoneResolver: ZoneResolverService
  ) {}

  private get vision(): VisionProvider {
    if (this.recognitionOverride) return this.recognitionOverride;
    if (!this.visionInstance) {
      try {
        this.visionInstance = new GeminiVisionProvider();
      } catch {
        this.visionInstance = new DevNoopVisionProvider();
      }
    }
    return this.visionInstance;
  }

  async today(aliasId: string) {
    // SPEC.md §39 — the member's own local language: walk UP from their zone
    // to the root (same chain shape as the region-scoping query below) and
    // take the first language_code set, since it's set on both the village
    // and its region when geocoded (§38) but only ever on the region for a
    // manually-created zone. Null (shown as English + Hindi only) if nothing
    // in the chain has one set yet — never a guessed language.
    const { rows: langRows } = await this.pool.query<{ language_code: string | null }>(
      `WITH RECURSIVE member_zone_chain AS (
         SELECT z.id, z.parent_id, z.language_code, 0 AS depth FROM zones z
         JOIN members m ON m.zone_id = z.id
         WHERE m.alias_id = $1
         UNION ALL
         SELECT z.id, z.parent_id, z.language_code, c.depth + 1 FROM zones z
         JOIN member_zone_chain c ON z.id = c.parent_id
       )
       SELECT language_code FROM member_zone_chain
       WHERE language_code IS NOT NULL
       ORDER BY depth LIMIT 1`,
      [aliasId]
    );
    const localLanguage = langRows[0]?.language_code ?? null;

    const { rows } = await this.pool.query<QuestionRow>(
      // Region scoping (SPEC.md §23): walk UP from the member's own zone to
      // the root, collecting every ancestor-or-self zone id. A question is
      // visible if it's global (zone_id IS NULL) or scoped to any zone in
      // that chain — so a question scoped to a constituency reaches every
      // village under it, but a question scoped to one village never reaches
      // a sibling village even under the same panchayat/hobli/constituency.
      `WITH RECURSIVE member_zone_chain AS (
         SELECT z.id, z.parent_id FROM zones z
         JOIN members m ON m.zone_id = z.id
         WHERE m.alias_id = $1
         UNION ALL
         SELECT z.id, z.parent_id FROM zones z
         JOIN member_zone_chain c ON z.id = c.parent_id
       )
       SELECT q.id, q.category_id, q.type, q.text_en, q.reward_tokens,
              q.allow_photo, q.allow_voice,
              qt_hi.text AS text_hi, qt_local.text AS text_local,
              COALESCE(
                json_agg(
                  json_build_object('id', o.id, 'labelEn', o.label_en, 'labelKn', o.label_kn, 'sort', o.sort)
                  ORDER BY o.sort
                ) FILTER (WHERE o.id IS NOT NULL),
                '[]'
              ) AS options
       FROM questions q
       LEFT JOIN question_options o ON o.question_id = q.id
       LEFT JOIN question_translations qt_hi ON qt_hi.question_id = q.id AND qt_hi.language_code = 'hi'
       LEFT JOIN question_translations qt_local
         ON qt_local.question_id = q.id AND qt_local.language_code = $3
       WHERE q.review_state = 'approved'
         AND q.active_from <= now()
         AND (q.active_to IS NULL OR q.active_to > now())
         AND (q.zone_id IS NULL OR q.zone_id IN (SELECT id FROM member_zone_chain))
         AND NOT EXISTS (
           SELECT 1 FROM responses r
           WHERE r.question_id = q.id AND r.alias_id = $1 AND r.answered_at::date = now()::date
         )
         -- the Vault off-switch (consents.granted = false) is absolute: a revoked
         -- category's questions stop being offered, not just excluded from sharing.
         AND NOT EXISTS (
           SELECT 1 FROM consents co
           WHERE co.category_id = q.category_id AND co.alias_id = $1 AND co.granted = false
         )
       GROUP BY q.id, qt_hi.text, qt_local.text
       ORDER BY q.id
       LIMIT $2`,
      [aliasId, PULSE_BATCH_SIZE, localLanguage]
    );

    return rows.map((q) => ({
      id: q.id,
      categoryId: q.category_id,
      type: q.type,
      textEn: q.text_en,
      textHi: q.text_hi,
      // Omitted entirely (not just null) when the local language IS Hindi —
      // showing the same translation twice under two labels would be noise,
      // not information (SPEC.md §39).
      textLocal: localLanguage && localLanguage !== "hi" ? q.text_local : null,
      localLanguage: localLanguage && localLanguage !== "hi" ? localLanguage : null,
      rewardTokens: q.reward_tokens,
      allowPhoto: q.allow_photo,
      allowVoice: q.allow_voice,
      options: q.options,
    }));
  }

  /**
   * Each answer is its own atomic transaction (SPEC.md §15A): the response row and
   * its token_ledger entry commit together or not at all. Idempotent per answer
   * (§15C) — replaying a client_msg_id credits nothing a second time.
   */
  async submitAnswers(aliasId: string, answers: PulseAnswerDto[], deviceFingerprint?: string) {
    const results: {
      clientMsgId: string;
      status: "credited" | "already_synced" | "rejected_velocity_cap";
    }[] = [];

    if (deviceFingerprint) {
      await withTransaction(this.pool, (client) =>
        this.fraud.recordDeviceFingerprint(client, aliasId, deviceFingerprint)
      );
    }

    for (const answer of answers) {
      // Supplementary evidence (SPEC.md §9A) — additive to the question's own
      // required structured answer, available regardless of question type.
      // Stored before the transaction like SnapsService does: it's I/O against
      // the storage provider, not the database.
      const photoStorageKey = answer.photoBase64
        ? (await this.storage.store(answer.photoBase64)).storageKey
        : null;

      // SPEC.md §35 — resolved outside the transaction (a read-only lookup,
      // not a write) and only the RESULT is ever passed on; answer.lat/lng
      // themselves are never referenced again after this line, so there's no
      // path by which a raw coordinate could end up in a query or a log.
      const answeredZoneId =
        answer.lat !== undefined && answer.lng !== undefined
          ? await this.zoneResolver.resolveNearestZone(answer.lat, answer.lng)
          : null;

      let result: "credited" | "already_synced" | "rejected_velocity_cap";
      let insertedResponseId: number | null = null;
      try {
        result = await withTransaction(this.pool, async (client) => {
          await this.fraud.enforceVelocityCap(client, aliasId);

          const { rows: qRows } = await client.query<{
            reward_tokens: number;
            type: string;
            category_id: number;
            intent_window: string | null;
            allow_photo: boolean;
            allow_voice: boolean;
          }>(
            `SELECT reward_tokens, type, category_id, intent_window, allow_photo, allow_voice
             FROM questions WHERE id = $1 AND review_state = 'approved'`,
            [answer.questionId]
          );
          if (!qRows[0]) throw new NotFoundException(`Question ${answer.questionId} not found`);
          // Gated per-question by whoever authored it (SPEC.md §34) — the
          // client shouldn't offer the control at all if it's off, but this
          // is the actual enforcement point, not just a UI nicety.
          if (answer.photoBase64 && !qRows[0].allow_photo) {
            throw new BadRequestException(`Question ${answer.questionId} doesn't accept photo answers`);
          }
          if (answer.inputMode === "voice" && !qRows[0].allow_voice) {
            throw new BadRequestException(`Question ${answer.questionId} doesn't accept voice answers`);
          }

          const { rows: inserted } = await client.query<{ id: number }>(
            `INSERT INTO responses
               (alias_id, question_id, option_ids, numeric_value, text_value, photo_storage_key,
                input_mode, language, answered_at, client_msg_id, zone_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (client_msg_id) DO NOTHING
             RETURNING id`,
            [
              aliasId,
              answer.questionId,
              answer.optionIds ?? null,
              answer.numericValue ?? null,
              answer.textValue ?? null,
              photoStorageKey,
              answer.inputMode,
              answer.language,
              answer.answeredAt,
              answer.clientMsgId,
              answeredZoneId,
            ]
          );

          if (!inserted[0]) {
            return "already_synced" as const;
          }
          insertedResponseId = inserted[0].id;

          await this.ledger.creditTokens({
            client,
            aliasId,
            entry:
              answer.inputMode === "voice"
                ? "earn_voice"
                : answer.inputMode === "snap"
                  ? "earn_snap"
                  : "earn_response",
            tokens: qRows[0].reward_tokens,
            refType: "response",
            refId: inserted[0].id,
          });

          // §5B/§6/Phase 4: an intent_window answer of "yes"/"maybe" IS a declared
          // demand — this is the row LAW 2's redemption gate checks for later.
          // A "no" (or anything else) declares nothing.
          if (qRows[0].type === "intent_window" && qRows[0].intent_window && answer.optionIds?.length) {
            const { rows: optRows } = await client.query<{ label_en: string }>(
              `SELECT label_en FROM question_options WHERE id = $1`,
              [answer.optionIds[0]]
            );
            const strength = optRows[0]?.label_en?.toLowerCase() === "yes"
              ? "yes"
              : optRows[0]?.label_en?.toLowerCase() === "maybe"
                ? "maybe"
                : null;

            if (strength) {
              // §6/§19A fraud engine: flag+decrement BEFORE inserting, so the
              // check reads only prior declarations — the current one is
              // never compared against itself.
              await this.fraud.checkIntentConsistency(client, aliasId, qRows[0].category_id, strength);

              const months = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 }[qRows[0].intent_window] ?? 1;
              await client.query(
                `INSERT INTO intents (alias_id, product_category_id, "window", strength, expires_at)
                 VALUES ($1, $2, $3, $4, now() + ($5 || ' months')::interval)`,
                [aliasId, qRows[0].category_id, qRows[0].intent_window, strength, months]
              );
            }
          }

          return "credited" as const;
        });
      } catch (err) {
        if (err instanceof VelocityCapExceededError) {
          results.push({ clientMsgId: answer.clientMsgId, status: "rejected_velocity_cap" });
          break; // already over the cap — every remaining answer in this batch would fail too
        }
        throw err;
      }

      // Same posture as SnapsService (SPEC.md §32): recognition runs after
      // the reward is already committed, never gating it, and only when a
      // photo actually came in on a question that allows one.
      if (result === "credited" && answer.photoBase64 && insertedResponseId) {
        const responseId = insertedResponseId;
        this.recognize(responseId, answer.photoBase64).catch((err) => {
          console.error(`Response ${responseId} recognition failed:`, (err as Error).message);
        });
      }

      results.push({ clientMsgId: answer.clientMsgId, status: result });
    }

    return { results };
  }

  private async recognize(responseId: number, imageBase64: string): Promise<void> {
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
      `UPDATE responses
       SET recognized_tags = $1, recognized_label = $2, recognized_confidence = $3,
           recognized_product_guess = $4, recognized_category_id = $5, recognized_at = now()
       WHERE id = $6`,
      [tags, label, confidence, productGuess, categoryRows[0]?.id ?? null, responseId]
    );
  }
}
