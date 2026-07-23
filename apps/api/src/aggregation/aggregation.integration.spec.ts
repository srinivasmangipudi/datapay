import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { AggregationService } from "./aggregation.service";

const VILLAGE_ZONE_ID = "00000000-0000-0000-0000-000000000005";

describe("Aggregation — the k-anonymity floor is enforced, not assumed (SPEC.md LAW 3 / §6A)", () => {
  let app: INestApplication;
  let pool: Pool;
  let aggregation: AggregationService;
  const createdAliasIds: string[] = [];
  let isolatedCategoryId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    aggregation = app.get(AggregationService);

    // A brand-new category+question, isolated from every other test's data,
    // so cohort counts in this file are exact, not "at least".
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO categories (slug, name, sensitivity) VALUES ($1, 'K-anon test category', 'standard') RETURNING id`,
      [`kanon-test-${randomUUID().slice(0, 8)}`]
    );
    isolatedCategoryId = rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM demand_aggregates WHERE category_id = $1`, [isolatedCategoryId]);
    await pool.query(`DELETE FROM responses WHERE alias_id = ANY($1)`, [createdAliasIds]);
    await pool.query(`DELETE FROM question_options WHERE question_id IN (SELECT id FROM questions WHERE category_id = $1)`, [isolatedCategoryId]);
    await pool.query(`DELETE FROM questions WHERE category_id = $1`, [isolatedCategoryId]);
    await pool.query(`DELETE FROM members WHERE alias_id = ANY($1)`, [createdAliasIds]).catch(() => {});
    await pool.query(`DELETE FROM categories WHERE id = $1`, [isolatedCategoryId]);
    await app.close();
    await pool.end();
  });

  async function seedMembersAnsweringNewQuestion(count: number, textEn: string) {
    const { rows: qRows } = await pool.query<{ id: number }>(
      `INSERT INTO questions (category_id, type, text_en, reward_tokens) VALUES ($1, 'single', $2, 4) RETURNING id`,
      [isolatedCategoryId, textEn]
    );
    const questionId = qRows[0].id;
    const { rows: optRows } = await pool.query<{ id: number }>(
      `INSERT INTO question_options (question_id, label_en, sort) VALUES ($1, 'Option A', 1) RETURNING id`,
      [questionId]
    );
    const optionId = optRows[0].id;

    for (let i = 0; i < count; i++) {
      const aliasId = `kanon_${randomUUID().replace(/-/g, "")}`;
      const displayAlias = `KANON TEST ${aliasId.slice(-8)}`;
      await pool.query(`INSERT INTO members (alias_id, display_alias, zone_id) VALUES ($1, $2, $3)`, [
        aliasId,
        displayAlias,
        VILLAGE_ZONE_ID,
      ]);
      createdAliasIds.push(aliasId);
      await pool.query(
        `INSERT INTO responses (alias_id, question_id, option_ids, input_mode, language, answered_at, client_msg_id)
         VALUES ($1, $2, $3, 'tap', 'en', now(), $4)`,
        [aliasId, questionId, [optionId], randomUUID()]
      );
    }
    return questionId;
  }

  it("suppresses the aggregate when cohort never clears 50, even at constituency level", async () => {
    await seedMembersAnsweringNewQuestion(10, "Suppression test question");

    const result = await aggregation.runForCategory(isolatedCategoryId);
    expect(result.published).toBe(0);
    expect(result.suppressed).toBeGreaterThan(0);

    const { rows } = await pool.query(`SELECT id FROM demand_aggregates WHERE category_id = $1`, [
      isolatedCategoryId,
    ]);
    expect(rows).toHaveLength(0);
  });

  it("publishes the aggregate once the cohort clears 50", async () => {
    await seedMembersAnsweringNewQuestion(45, "Threshold test question"); // 10 + 45 = 55 total in this category now

    const result = await aggregation.runForCategory(isolatedCategoryId);
    expect(result.published).toBeGreaterThanOrEqual(1);

    const { rows } = await pool.query<{ cohort_size: number }>(
      `SELECT cohort_size FROM demand_aggregates WHERE category_id = $1`,
      [isolatedCategoryId]
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].cohort_size).toBeGreaterThanOrEqual(50);
  });

  it("the database itself rejects a demand_aggregates row with cohort_size < 50", async () => {
    await expect(
      pool.query(
        `INSERT INTO demand_aggregates (category_id, zone_id, "window", metric, cohort_size)
         VALUES ($1, $2, 'test', '{}'::jsonb, 10)`,
        [isolatedCategoryId, VILLAGE_ZONE_ID]
      )
    ).rejects.toThrow();
  });
});
