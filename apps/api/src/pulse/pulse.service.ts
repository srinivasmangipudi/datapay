import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PulseAnswerDto } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
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
    private readonly ledger: LedgerService
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
  async submitAnswers(aliasId: string, answers: PulseAnswerDto[]) {
    const results: { clientMsgId: string; status: "credited" | "already_synced" }[] = [];

    for (const answer of answers) {
      const result = await withTransaction(this.pool, async (client) => {
        const { rows: qRows } = await client.query<{ reward_tokens: number }>(
          `SELECT reward_tokens FROM questions WHERE id = $1 AND review_state = 'approved'`,
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
        return "credited" as const;
      });

      results.push({ clientMsgId: answer.clientMsgId, status: result });
    }

    return { results };
  }
}
