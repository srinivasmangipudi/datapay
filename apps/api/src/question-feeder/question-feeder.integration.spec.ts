import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { createTestMember, deleteTestMember, TestMember } from "../test-fixtures";

describe("Question Feeder Engine — draft questions never reach a member unreviewed (SPEC.md §14)", () => {
  let app: INestApplication;
  let pool: Pool;
  let member: TestMember;
  let topicId: number;
  let draftQuestionId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    const jwt = app.get(JwtService);
    member = await createTestMember(pool, jwt);

    const { rows: catRows } = await pool.query<{ id: number }>(
      `SELECT id FROM categories WHERE slug = 'soap'`
    );
    if (!catRows[0]) {
      await pool.query(
        `INSERT INTO categories (slug, name, sensitivity) VALUES ('soap', 'Soap', 'standard')`
      );
    }
    const { rows: soap } = await pool.query<{ id: number }>(
      `SELECT id FROM categories WHERE slug = 'soap'`
    );

    const topicRes = await request(app.getHttpServer())
      .post("/v1/admin/question-topics")
      .send({
        slug: `soap-topic-${Date.now()}`,
        name: "Soap variants",
        categoryId: soap[0].id,
        generatorKind: "template",
        config: {
          variants: [
            {
              textEn: "Which soap brand does your household use?",
              type: "single",
              rewardTokens: 3,
              options: [{ labelEn: "Brand A" }, { labelEn: "Brand B" }],
            },
          ],
        },
      });
    topicId = topicRes.body.id;
  });

  afterAll(async () => {
    // Clean up every test-generated topic/question, including leftovers from
    // earlier runs — otherwise accumulated approved questions eventually push
    // past pulse/today's LIMIT 5 and make this test flaky on repeated runs.
    const { rows: testTopics } = await pool.query<{ id: number }>(
      `SELECT id FROM question_topics WHERE slug LIKE 'soap-topic-%' OR slug LIKE 'bad-topic-%'`
    );
    for (const { id } of testTopics) {
      await pool.query(
        `DELETE FROM question_options WHERE question_id IN (SELECT id FROM questions WHERE generator_topic_id = $1)`,
        [id]
      );
      await pool.query(`DELETE FROM questions WHERE generator_topic_id = $1`, [id]);
      await pool.query(`DELETE FROM question_generation_runs WHERE topic_id = $1`, [id]);
      await pool.query(`DELETE FROM question_topics WHERE id = $1`, [id]);
    }

    await deleteTestMember(pool, member.aliasId);
    await app.close();
    await pool.end();
  });

  it("generates drafts that are excluded from pulse/today until approved", async () => {
    const genRes = await request(app.getHttpServer()).post(
      `/v1/admin/question-topics/${topicId}/generate`
    );
    expect(genRes.status).toBe(201);
    expect(genRes.body.status).toBe("completed");
    expect(genRes.body.questionsGenerated).toBe(1);

    const drafts = await request(app.getHttpServer()).get("/v1/admin/questions?review_state=draft");
    const draft = drafts.body.find((q: { generation_run_id: number }) => q.generation_run_id === genRes.body.runId);
    expect(draft).toBeDefined();
    draftQuestionId = draft.id;

    const today = await request(app.getHttpServer())
      .get("/v1/pulse/today")
      .set({ Authorization: `Bearer ${member.token}` });
    expect(today.body.map((q: { id: number }) => q.id)).not.toContain(draftQuestionId);
  });

  it("promotes the draft to approved, and it becomes selectable", async () => {
    const approveRes = await request(app.getHttpServer()).post(
      `/v1/admin/questions/${draftQuestionId}/approve`
    );
    expect(approveRes.status).toBe(201);
    expect(approveRes.body.review_state).toBe("approved");

    const today = await request(app.getHttpServer())
      .get("/v1/pulse/today")
      .set({ Authorization: `Bearer ${member.token}` });
    expect(today.body.map((q: { id: number }) => q.id)).toContain(draftQuestionId);
  });

  it("a failed generation run leaves no partial drafts (§14B)", async () => {
    const badTopicRes = await request(app.getHttpServer())
      .post("/v1/admin/question-topics")
      .send({
        slug: `bad-topic-${Date.now()}`,
        name: "Bad config",
        categoryId: 1,
        generatorKind: "template",
        config: { variants: [] }, // fails TemplateConfigSchema's min(1)
      });

    const genRes = await request(app.getHttpServer()).post(
      `/v1/admin/question-topics/${badTopicRes.body.id}/generate`
    );
    expect(genRes.status).toBe(400);

    const run = await request(app.getHttpServer()).get(
      `/v1/admin/question-generation-runs/${
        (await pool.query(`SELECT id FROM question_generation_runs WHERE topic_id = $1`, [
          badTopicRes.body.id,
        ])).rows[0].id
      }`
    );
    expect(run.body.status).toBe("failed");
    expect(run.body.questions_generated).toBe(0);
  });
});
