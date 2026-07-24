import { getQueueToken } from "@nestjs/bullmq";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Queue } from "bullmq";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { QUESTION_GENERATION_QUEUE } from "./question-generation-queue";

describe("Scheduled question generation — a topic's own cron drives an unattended generation run (SPEC.md §24)", () => {
  let app: INestApplication;
  let pool: Pool;
  let queue: Queue;
  let categoryId: number;
  const createdTopicIds: number[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    queue = app.get<Queue>(getQueueToken(QUESTION_GENERATION_QUEUE));

    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM categories WHERE slug = 'soap'`
    );
    if (rows[0]) {
      categoryId = rows[0].id;
    } else {
      const inserted = await pool.query<{ id: number }>(
        `INSERT INTO categories (slug, name, sensitivity) VALUES ('soap', 'Soap', 'standard') RETURNING id`
      );
      categoryId = inserted.rows[0].id;
    }
  });

  afterAll(async () => {
    for (const topicId of createdTopicIds) {
      await queue.removeJobScheduler(`topic-${topicId}`).catch(() => {});
      await pool.query(`DELETE FROM question_generation_runs WHERE topic_id = $1`, [topicId]);
      await pool.query(`DELETE FROM question_topics WHERE id = $1`, [topicId]);
    }
    await app.close();
    await pool.end();
  }, 15000);

  it("rejects a topic with an invalid cron string, before ever inserting it", async () => {
    const before = await pool.query(`SELECT COUNT(*) FROM question_topics`);

    const res = await request(app.getHttpServer())
      .post("/v1/admin/question-topics")
      .send({
        slug: `bad-cron-${Date.now()}`,
        name: "Bad cron",
        categoryId,
        generatorKind: "template",
        config: { variants: [{ textEn: "x", type: "single", rewardTokens: 3, options: [{ labelEn: "A" }, { labelEn: "B" }] }] },
        scheduleCron: "not a cron string",
      });
    expect(res.status).toBe(400);

    const after = await pool.query(`SELECT COUNT(*) FROM question_topics`);
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  it("registers a repeating job for a topic created with a valid cron", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/admin/question-topics")
      .send({
        slug: `good-cron-${Date.now()}`,
        name: "Daily at midnight",
        categoryId,
        generatorKind: "template",
        config: { variants: [{ textEn: "x", type: "single", rewardTokens: 3, options: [{ labelEn: "A" }, { labelEn: "B" }] }] },
        scheduleCron: "0 0 * * *",
      });
    expect(res.status).toBe(201);
    createdTopicIds.push(res.body.id);

    const scheduler = await queue.getJobScheduler(`topic-${res.body.id}`);
    expect(scheduler?.pattern).toBe("0 0 * * *");
  });

  it("a topic created with no cron registers no repeating job", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/admin/question-topics")
      .send({
        slug: `no-cron-${Date.now()}`,
        name: "Manual only",
        categoryId,
        generatorKind: "template",
        config: { variants: [{ textEn: "x", type: "single", rewardTokens: 3, options: [{ labelEn: "A" }, { labelEn: "B" }] }] },
      });
    expect(res.status).toBe(201);
    createdTopicIds.push(res.body.id);

    const scheduler = await queue.getJobScheduler(`topic-${res.body.id}`);
    expect(scheduler).toBeUndefined();
  });
});
