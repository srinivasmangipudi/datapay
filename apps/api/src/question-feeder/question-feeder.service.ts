import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { QuestionTopicDto } from "@datapay/shared";
import { Pool } from "pg";
import { z } from "zod";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";

// The 'template' generator's config shape — deterministic, no external calls.
// Each variant becomes one draft question. 'llm_assisted' topics validate
// nothing here; they're not implemented yet (see generate() below).
const TemplateConfigSchema = z.object({
  variants: z
    .array(
      z.object({
        textEn: z.string().min(1),
        textKn: z.string().optional(),
        type: z.enum(["single", "multi", "yesno", "intent_window", "numeric"]),
        rewardTokens: z.number().int().positive().default(4),
        options: z
          .array(z.object({ labelEn: z.string().min(1), labelKn: z.string().optional() }))
          .optional(),
      })
    )
    .min(1),
});

@Injectable()
export class QuestionFeederService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async createTopic(dto: QuestionTopicDto) {
    const { rows } = await this.pool.query<{ id: number }>(
      `INSERT INTO question_topics (slug, name, category_id, generator_kind, config, schedule_cron)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [dto.slug, dto.name, dto.categoryId, dto.generatorKind, dto.config, dto.scheduleCron ?? null]
    );
    return { id: rows[0].id };
  }

  async generate(topicId: number) {
    const { rows: topicRows } = await this.pool.query<{
      id: number;
      category_id: number;
      generator_kind: string;
      config: unknown;
    }>(`SELECT id, category_id, generator_kind, config FROM question_topics WHERE id = $1`, [
      topicId,
    ]);
    const topic = topicRows[0];
    if (!topic) throw new NotFoundException(`Topic ${topicId} not found`);

    // Phase 1 of 2: the run row commits on its own, before any generation is
    // attempted — so a failed generation still leaves a visible 'failed' run,
    // not silence (SPEC.md §14B).
    const { rows: runRows } = await this.pool.query<{ id: number }>(
      `INSERT INTO question_generation_runs (topic_id, status) VALUES ($1, 'running') RETURNING id`,
      [topicId]
    );
    const runId = runRows[0].id;

    try {
      const count = await this.runGenerator(topic, runId);
      await this.pool.query(
        `UPDATE question_generation_runs SET status = 'completed', questions_generated = $1, completed_at = now() WHERE id = $2`,
        [count, runId]
      );
      return { runId, status: "completed", questionsGenerated: count };
    } catch (err) {
      await this.pool.query(
        `UPDATE question_generation_runs SET status = 'failed', completed_at = now() WHERE id = $1`,
        [runId]
      );
      if (err instanceof z.ZodError) {
        throw new BadRequestException(err.flatten());
      }
      throw err;
    }
  }

  private async runGenerator(
    topic: { id: number; category_id: number; generator_kind: string; config: unknown },
    runId: number
  ): Promise<number> {
    if (topic.generator_kind === "llm_assisted") {
      // Not implemented — no model wiring in this pass. Fails the run cleanly
      // rather than faking generated content.
      throw new BadRequestException("llm_assisted generator is not implemented yet");
    }

    const config = TemplateConfigSchema.parse(topic.config);

    // Phase 2 of 2: draft questions + options are one transaction — if any
    // variant fails, NONE of this run's drafts persist (§14B, no partial batches).
    return withTransaction(this.pool, async (client) => {
      let count = 0;
      for (const variant of config.variants) {
        const { rows: qRows } = await client.query<{ id: number }>(
          `INSERT INTO questions
             (category_id, type, text_en, text_kn, reward_tokens, source, generator_topic_id, generation_run_id, review_state)
           VALUES ($1, $2, $3, $4, $5, 'plugin_generated', $6, $7, 'draft')
           RETURNING id`,
          [
            topic.category_id,
            variant.type,
            variant.textEn,
            variant.textKn ?? null,
            variant.rewardTokens,
            topic.id,
            runId,
          ]
        );
        const questionId = qRows[0].id;

        if (variant.options?.length) {
          for (const [i, opt] of variant.options.entries()) {
            await client.query(
              `INSERT INTO question_options (question_id, label_en, label_kn, sort) VALUES ($1, $2, $3, $4)`,
              [questionId, opt.labelEn, opt.labelKn ?? null, i]
            );
          }
        }
        count += 1;
      }
      return count;
    });
  }

  async getRun(runId: number) {
    const { rows } = await this.pool.query(
      `SELECT id, topic_id, status, questions_generated, triggered_at, completed_at
       FROM question_generation_runs WHERE id = $1`,
      [runId]
    );
    if (!rows[0]) throw new NotFoundException(`Run ${runId} not found`);
    return rows[0];
  }

  async listQuestionsByReviewState(reviewState: string) {
    const { rows } = await this.pool.query(
      `SELECT id, category_id, type, text_en, text_kn, reward_tokens, source, generation_run_id, review_state
       FROM questions WHERE review_state = $1 ORDER BY id`,
      [reviewState]
    );
    return rows;
  }

  async review(questionId: number, decision: "approved" | "rejected") {
    const { rows } = await this.pool.query(
      `UPDATE questions SET review_state = $1 WHERE id = $2 AND review_state = 'draft' RETURNING id, review_state`,
      [decision, questionId]
    );
    if (!rows[0]) {
      throw new NotFoundException(`Draft question ${questionId} not found`);
    }
    return rows[0];
  }
}
