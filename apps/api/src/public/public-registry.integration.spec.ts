import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { AggregationService } from "../aggregation/aggregation.service";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { PublicService } from "./public.service";

const VILLAGE_ZONE_ID = "00000000-0000-0000-0000-000000000005";
const SUITE = randomUUID().slice(0, 8);

// SPEC.md §43 — the public registry's two buckets. These assertions are about
// what may LEAVE the system, so every one of them is written as "this must not
// appear", not "this should appear".
describe("Public demand registry — two buckets, one floor (SPEC.md §43 / LAW 3)", () => {
  let app: INestApplication;
  let pool: Pool;
  let aggregation: AggregationService;
  let publicService: PublicService;

  const categoryIds: number[] = [];
  let productCategoryId: number;
  let topicCategoryId: number;
  let unpublishedCategoryId: number;
  let freeTextQuestionId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    aggregation = app.get(AggregationService);
    publicService = app.get(PublicService);

    productCategoryId = await createCategory("product", true, "Registry test product");
    topicCategoryId = await createCategory("topic", true, "Registry test topic");
    unpublishedCategoryId = await createCategory("product", false, "Registry test unpublished");
  }, 60_000);

  afterAll(async () => {
    // Scoped by category rather than by a collected-ids array, for the reason
    // aggregation.integration.spec.ts spells out: a run killed mid-flight never
    // reaches this block, so a surviving run's cleanup shouldn't depend on
    // in-memory bookkeeping being complete.
    for (const categoryId of categoryIds) {
      await pool.query(
        `DELETE FROM question_stat_aggregates WHERE question_id IN
           (SELECT id FROM questions WHERE category_id = $1)`,
        [categoryId]
      );
      await pool.query(`DELETE FROM demand_aggregates WHERE category_id = $1`, [categoryId]);
      await pool.query(
        `DELETE FROM responses WHERE question_id IN (SELECT id FROM questions WHERE category_id = $1)`,
        [categoryId]
      );
      await pool.query(
        `DELETE FROM question_options WHERE question_id IN (SELECT id FROM questions WHERE category_id = $1)`,
        [categoryId]
      );
      await pool.query(`DELETE FROM questions WHERE category_id = $1`, [categoryId]);
    }
    await pool.query(`DELETE FROM members WHERE alias_id LIKE $1`, [`reg_${SUITE}_%`]);
    await pool.query(`DELETE FROM categories WHERE id = ANY($1)`, [categoryIds]);
    await app.close();
    await pool.end();
  }, 60_000);

  async function createCategory(kind: string, published: boolean, name: string): Promise<number> {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO categories (slug, name, sensitivity, kind, published)
       VALUES ($1, $2, 'standard', $3, $4) RETURNING id`,
      [`reg-test-${kind}-${published}-${SUITE}`, name, kind, published]
    );
    categoryIds.push(rows[0].id);
    return rows[0].id;
  }

  /** Seeds `count` members in one village, each answering one new question. */
  async function seedAnsweredQuestion(
    categoryId: number,
    type: string,
    textEn: string,
    count: number
  ): Promise<number> {
    const { rows: qRows } = await pool.query<{ id: number }>(
      `INSERT INTO questions (category_id, type, text_en, reward_tokens) VALUES ($1, $2, $3, 4) RETURNING id`,
      [categoryId, type, textEn]
    );
    const questionId = qRows[0].id;

    let optionId: number | null = null;
    if (type !== "numeric" && type !== "free_text") {
      const { rows: optRows } = await pool.query<{ id: number }>(
        `INSERT INTO question_options (question_id, label_en, sort) VALUES ($1, 'Yes', 1) RETURNING id`,
        [questionId]
      );
      optionId = optRows[0].id;
    }

    for (let i = 0; i < count; i++) {
      const aliasId = `reg_${SUITE}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      await pool.query(
        `INSERT INTO members (alias_id, display_alias, zone_id) VALUES ($1, $2, $3)`,
        [aliasId, `REG TEST ${aliasId.slice(-8)}`, VILLAGE_ZONE_ID]
      );
      await pool.query(
        `INSERT INTO responses
           (alias_id, question_id, option_ids, numeric_value, text_value, input_mode, language, answered_at, client_msg_id)
         VALUES ($1, $2, $3, $4, $5, 'tap', 'en', now(), $6)`,
        [
          aliasId,
          questionId,
          optionId ? [optionId] : null,
          type === "numeric" ? 12 : null,
          type === "free_text" ? `secret answer ${aliasId}` : null,
          randomUUID(),
        ]
      );
    }
    return questionId;
  }

  it("publishes a product category's questions into the products bucket, and nothing else", async () => {
    await seedAnsweredQuestion(productCategoryId, "yesno", `Product Q ${SUITE}`, 55);
    await seedAnsweredQuestion(topicCategoryId, "single", `Topic Q ${SUITE}`, 55);

    const stats = await aggregation.runQuestionStats();
    expect(stats.published).toBeGreaterThan(0);

    const { products, topics } = await publicService.getRegistry();

    const productGroup = products.find((g) => g.category_id === productCategoryId);
    expect(productGroup).toBeDefined();
    expect(productGroup!.households).toBeGreaterThanOrEqual(50);
    expect(productGroup!.questions.some((q) => q.text === `Product Q ${SUITE}`)).toBe(true);

    // The same category must not also surface in the other bucket — the split
    // is a partition, not a tag.
    expect(topics.some((g) => g.category_id === productCategoryId)).toBe(false);
    expect(products.some((g) => g.category_id === topicCategoryId)).toBe(false);
  }, 120_000);

  it("publishes a topic category's questions into the topics bucket", async () => {
    const { topics } = await publicService.getRegistry();
    const topicGroup = topics.find((g) => g.category_id === topicCategoryId);
    expect(topicGroup).toBeDefined();
    expect(topicGroup!.questions.some((q) => q.text === `Topic Q ${SUITE}`)).toBe(true);
  }, 60_000);

  it("never publishes an unpublished category, however large its cohort", async () => {
    await seedAnsweredQuestion(unpublishedCategoryId, "yesno", `Unpublished Q ${SUITE}`, 60);
    await aggregation.runQuestionStats();

    const { products, topics, registry, opportunities } = await publicService.getRegistry();
    const everywhere = [...products, ...topics];
    expect(everywhere.some((g) => g.category_id === unpublishedCategoryId)).toBe(false);
    expect(everywhere.flatMap((g) => g.questions).some((q) => q.text.includes("Unpublished"))).toBe(
      false
    );
    // The category-level sections are filtered on the same flag.
    for (const row of [...registry, ...opportunities]) {
      expect(row.category_name).not.toBe("Registry test unpublished");
    }
  }, 120_000);

  it("never publishes a free_text answer, even with a cohort far above the floor", async () => {
    freeTextQuestionId = await seedAnsweredQuestion(
      productCategoryId,
      "free_text",
      `Free text Q ${SUITE}`,
      60
    );
    await aggregation.runQuestionStats();

    const { rows } = await pool.query(
      `SELECT id FROM question_stat_aggregates WHERE question_id = $1`,
      [freeTextQuestionId]
    );
    expect(rows).toHaveLength(0);

    const { products } = await publicService.getRegistry();
    const serialized = JSON.stringify(products);
    expect(serialized).not.toContain("secret answer");
    expect(serialized).not.toContain(`Free text Q ${SUITE}`);
  }, 120_000);

  it("the database itself rejects a question_stat_aggregates row below the floor", async () => {
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM questions WHERE category_id = $1 LIMIT 1`,
      [productCategoryId]
    );
    await expect(
      pool.query(
        `INSERT INTO question_stat_aggregates (question_id, zone_id, "window", distribution, cohort_size)
         VALUES ($1, $2, 'trigger-test', '{}'::jsonb, 3)`,
        [rows[0].id, VILLAGE_ZONE_ID]
      )
    ).rejects.toThrow(/LAW 3/);
  }, 60_000);

  it("reports the floor it actually enforced, so the page can label relaxed data", async () => {
    const { meta } = await publicService.getRegistry();
    expect(meta.production_floor).toBe(50);
    expect(meta.k_anon_floor).toBeGreaterThanOrEqual(1);
    expect(meta.relaxed_floor).toBe(meta.k_anon_floor < 50);

    const { rows } = await pool.query<{ k_anon_floor: number }>(
      `SELECT k_anon_floor FROM system_settings WHERE id = 1`
    );
    // The job's floor and the trigger's floor are the same number, or every
    // insert the job attempts would be rejected by the database.
    expect(rows[0].k_anon_floor).toBe(meta.k_anon_floor);
  }, 60_000);
});
