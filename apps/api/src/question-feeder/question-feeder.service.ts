import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { QuestionTopicDto } from "@datapay/shared";
import { Pool, PoolClient } from "pg";
import { z } from "zod";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
import { DocumentGroundedGeneratorService } from "../intelligence/document-grounded-generator.service";
import { QuestionVariantSchema } from "./question-variant.schema";

export { QuestionVariantSchema };

// The 'template' generator's config shape — deterministic, no external calls.
// Each variant becomes one draft question.
const TemplateConfigSchema = z.object({
  variants: z.array(QuestionVariantSchema).min(1),
});

@Injectable()
export class QuestionFeederService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly documentGrounded: DocumentGroundedGeneratorService
  ) {}

  async createTopic(dto: QuestionTopicDto) {
    const { rows } = await this.pool.query<{ id: number }>(
      `INSERT INTO question_topics (slug, name, category_id, generator_kind, config, schedule_cron, zone_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        dto.slug,
        dto.name,
        dto.categoryId,
        dto.generatorKind,
        dto.config,
        dto.scheduleCron ?? null,
        dto.zoneId ?? null,
      ]
    );
    return { id: rows[0].id };
  }

  async generate(topicId: number) {
    const { rows: topicRows } = await this.pool.query<{
      id: number;
      category_id: number;
      generator_kind: string;
      config: unknown;
      zone_id: string | null;
    }>(`SELECT id, category_id, generator_kind, config, zone_id FROM question_topics WHERE id = $1`, [
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
    topic: {
      id: number;
      category_id: number;
      generator_kind: string;
      config: unknown;
      zone_id: string | null;
    },
    runId: number
  ): Promise<number> {
    let variants: z.infer<typeof QuestionVariantSchema>[];

    if (topic.generator_kind === "llm_assisted") {
      // Not implemented — no model wiring in this pass. Fails the run cleanly
      // rather than faking generated content.
      throw new BadRequestException("llm_assisted generator is not implemented yet");
    } else if (topic.generator_kind === "document_grounded") {
      // SPEC.md §20D: the LLM drafts variants grounded in this topic's
      // zone's understanding; validated against the exact same schema a
      // human-authored template variant would be.
      variants = await this.documentGrounded.generateVariants({
        zoneId: topic.zone_id,
        categoryId: topic.category_id,
        config: topic.config,
      });
    } else {
      variants = TemplateConfigSchema.parse(topic.config).variants;
    }

    return this.persistVariants(topic.id, topic.category_id, runId, variants);
  }

  // Phase 2 of 2: draft questions + options are one transaction — if any
  // variant fails, NONE of this run's drafts persist (§14B, no partial batches).
  // Shared by every generator kind — a document-grounded draft gets exactly
  // the same review-queue treatment a template draft does.
  private async persistVariants(
    topicId: number,
    categoryId: number,
    runId: number,
    variants: z.infer<typeof QuestionVariantSchema>[]
  ): Promise<number> {
    return withTransaction(this.pool, async (client: PoolClient) => {
      let count = 0;
      for (const variant of variants) {
        const { rows: qRows } = await client.query<{ id: number }>(
          `INSERT INTO questions
             (category_id, type, text_en, text_kn, reward_tokens, source, generator_topic_id, generation_run_id, review_state)
           VALUES ($1, $2, $3, $4, $5, 'plugin_generated', $6, $7, 'draft')
           RETURNING id`,
          [
            categoryId,
            variant.type,
            variant.textEn,
            variant.textKn ?? null,
            variant.rewardTokens,
            topicId,
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
