import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PulseAnswerDto } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
import { FraudService, VelocityCapExceededError } from "../fraud/fraud.service";
import { LedgerService } from "../ledger/ledger.service";

const PULSE_BATCH_SIZE = 5;

interface QuestionRow {
  id: number;
  category_id: number;
  type: string;
  text_en: string;
  text_kn: string | null;
  reward_tokens: number;
  options: { id: number; labelEn: string; labelKn: string | null; sort: number }[];
}

@Injectable()
export class PulseService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly ledger: LedgerService,
    private readonly fraud: FraudService
  ) {}

  async today(aliasId: string) {
    const { rows } = await this.pool.query<QuestionRow>(
      `SELECT q.id, q.category_id, q.type, q.text_en, q.text_kn, q.reward_tokens,
              COALESCE(
                json_agg(
                  json_build_object('id', o.id, 'labelEn', o.label_en, 'labelKn', o.label_kn, 'sort', o.sort)
                  ORDER BY o.sort
                ) FILTER (WHERE o.id IS NOT NULL),
                '[]'
              ) AS options
       FROM questions q
       LEFT JOIN question_options o ON o.question_id = q.id
       WHERE q.review_state = 'approved'
         AND q.active_from <= now()
         AND (q.active_to IS NULL OR q.active_to > now())
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
       GROUP BY q.id
       ORDER BY q.id
       LIMIT $2`,
      [aliasId, PULSE_BATCH_SIZE]
    );

    return rows.map((q) => ({
      id: q.id,
      categoryId: q.category_id,
      type: q.type,
      textEn: q.text_en,
      textKn: q.text_kn,
      rewardTokens: q.reward_tokens,
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
      let result: "credited" | "already_synced" | "rejected_velocity_cap";
      try {
        result = await withTransaction(this.pool, async (client) => {
          await this.fraud.enforceVelocityCap(client, aliasId);

          const { rows: qRows } = await client.query<{
            reward_tokens: number;
            type: string;
            category_id: number;
            intent_window: string | null;
          }>(
            `SELECT reward_tokens, type, category_id, intent_window
             FROM questions WHERE id = $1 AND review_state = 'approved'`,
            [answer.questionId]
          );
          if (!qRows[0]) throw new NotFoundException(`Question ${answer.questionId} not found`);

          const { rows: inserted } = await client.query<{ id: number }>(
            `INSERT INTO responses
               (alias_id, question_id, option_ids, numeric_value, input_mode, language, answered_at, client_msg_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (client_msg_id) DO NOTHING
             RETURNING id`,
            [
              aliasId,
              answer.questionId,
              answer.optionIds ?? null,
              answer.numericValue ?? null,
              answer.inputMode,
              answer.language,
              answer.answeredAt,
              answer.clientMsgId,
            ]
          );

          if (!inserted[0]) {
            return "already_synced" as const;
          }

          await this.ledger.creditTokens({
            client,
            aliasId,
            entry: answer.inputMode === "voice" ? "earn_voice" : "earn_response",
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

      results.push({ clientMsgId: answer.clientMsgId, status: result });
    }

    return { results };
  }
}
