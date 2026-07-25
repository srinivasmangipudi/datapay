import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import type { CategoryOption, SnapRecognition, VisionProvider } from "../snaps/vision.provider";
import { createTestMember, deleteTestMember, TestMember } from "../test-fixtures";
import { PulseService } from "./pulse.service";

class FakeVisionProvider implements VisionProvider {
  async analyze(_imageBase64: string, categories: CategoryOption[]): Promise<SnapRecognition> {
    const rice = categories.find((c) => c.slug === "rice");
    return {
      tags: ["rice", "bag"],
      label: "bag of rice",
      confidence: 0.85,
      productGuess: "Sona Masuri",
      categorySlug: rice?.slug ?? null,
    };
  }
}

describe("Pulse — selection + atomic/idempotent answering (SPEC.md §15A/§15C)", () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  let member: TestMember;
  let riceQuestionId: number;
  let riceCategoryId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
    member = await createTestMember(pool, jwt);
    // Real Gemini calls would be slow and non-deterministic in CI — same
    // override seam as SnapsService.recognitionOverride.
    app.get(PulseService).recognitionOverride = new FakeVisionProvider();

    const { rows } = await pool.query<{ id: number; category_id: number }>(
      `SELECT id, category_id FROM questions WHERE text_en = 'Which rice does your household buy?'`
    );
    riceQuestionId = rows[0].id;
    riceCategoryId = rows[0].category_id;
  });

  // A one-off gating/recognition test needs its own question (allow_photo/
  // allow_voice set explicitly), not the shared seeded rice question — same
  // per-test-creates-and-deletes-its-own-rows discipline as create-question's spec.
  async function createGatedQuestion(opts: { allowPhoto?: boolean; allowVoice?: boolean } = {}): Promise<number> {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO questions (category_id, type, text_en, reward_tokens, allow_photo, allow_voice)
       VALUES ($1, 'numeric', $2, 3, $3, $4)
       RETURNING id`,
      [riceCategoryId, `Gating test ${randomUUID()}`, opts.allowPhoto ?? true, opts.allowVoice ?? true]
    );
    return rows[0].id;
  }

  async function deleteGatedQuestion(id: number): Promise<void> {
    await pool.query(`DELETE FROM responses WHERE question_id = $1`, [id]);
    await pool.query(`DELETE FROM questions WHERE id = $1`, [id]);
  }

  afterAll(async () => {
    await deleteTestMember(pool, member.aliasId);
    await app.close();
    await pool.end();
  });

  function auth() {
    return { Authorization: `Bearer ${member.token}` };
  }

  it("includes the seeded rice question before it's been answered today", async () => {
    const res = await request(app.getHttpServer()).get("/v1/pulse/today").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.map((q: { id: number }) => q.id)).toContain(riceQuestionId);
  });

  it("answering credits tokens atomically, and excludes the question from today's list afterward", async () => {
    const before = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );

    const clientMsgId = randomUUID();
    const res = await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth())
      .send({
        answers: [
          {
            clientMsgId,
            questionId: riceQuestionId,
            optionIds: [],
            inputMode: "tap",
            language: "en",
            answeredAt: new Date().toISOString(),
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.results).toEqual([{ clientMsgId, status: "credited" }]);

    const after = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    expect(after.rows[0].token_balance).toBeGreaterThan(before.rows[0].token_balance);

    const today = await request(app.getHttpServer()).get("/v1/pulse/today").set(auth());
    expect(today.body.map((q: { id: number }) => q.id)).not.toContain(riceQuestionId);
  });

  it("replaying the same client_msg_id is a clean no-op — zero additional ledger entries (§15C)", async () => {
    const { rows: ledgerBefore } = await pool.query(
      `SELECT id FROM token_ledger WHERE alias_id = $1 AND ref_type = 'response'`,
      [member.aliasId]
    );
    const clientMsgId = randomUUID();

    const first = await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth())
      .send({
        answers: [
          {
            clientMsgId,
            questionId: riceQuestionId,
            optionIds: [],
            inputMode: "tap",
            language: "en",
            answeredAt: new Date().toISOString(),
          },
        ],
      });
    expect(first.body.results[0].status).toBe("credited");

    const replay = await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth())
      .send({
        answers: [
          {
            clientMsgId,
            questionId: riceQuestionId,
            optionIds: [],
            inputMode: "tap",
            language: "en",
            answeredAt: new Date().toISOString(),
          },
        ],
      });
    expect(replay.body.results[0].status).toBe("already_synced");

    const { rows: ledgerAfter } = await pool.query(
      `SELECT id FROM token_ledger WHERE alias_id = $1 AND ref_type = 'response'`,
      [member.aliasId]
    );
    expect(ledgerAfter.length).toBe(ledgerBefore.length + 1);
  });

  it("respects the Vault consent off-switch — a revoked category disappears from today's pulse", async () => {
    const { rows: catRows } = await pool.query<{ category_id: number }>(
      `SELECT category_id FROM questions WHERE id = $1`,
      [riceQuestionId]
    );
    const categoryId = catRows[0].category_id;

    await request(app.getHttpServer())
      .put(`/v1/vault/consents/${categoryId}`)
      .set(auth())
      .send({ granted: false });

    const today = await request(app.getHttpServer()).get("/v1/pulse/today").set(auth());
    expect(today.body.map((q: { categoryId: number }) => q.categoryId)).not.toContain(categoryId);

    // restore for other tests / re-runs
    await request(app.getHttpServer())
      .put(`/v1/vault/consents/${categoryId}`)
      .set(auth())
      .send({ granted: true });
  });

  it("SPEC.md §34: rejects a photo answer when the question doesn't allow photos", async () => {
    const qId = await createGatedQuestion({ allowPhoto: false });
    const res = await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth())
      .send({
        answers: [
          {
            clientMsgId: randomUUID(),
            questionId: qId,
            numericValue: 3,
            photoBase64: Buffer.from("fake-jpeg").toString("base64"),
            inputMode: "tap",
            language: "en",
            answeredAt: new Date().toISOString(),
          },
        ],
      });
    expect(res.status).toBe(400);
    await deleteGatedQuestion(qId);
  });

  it("SPEC.md §34: rejects a voice-mode answer when the question doesn't allow voice", async () => {
    const qId = await createGatedQuestion({ allowVoice: false });
    const res = await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth())
      .send({
        answers: [
          {
            clientMsgId: randomUUID(),
            questionId: qId,
            numericValue: 3,
            textValue: "spoken and transcribed text",
            inputMode: "voice",
            language: "en",
            answeredAt: new Date().toISOString(),
          },
        ],
      });
    expect(res.status).toBe(400);
    await deleteGatedQuestion(qId);
  });

  it("SPEC.md §34: recognizes an attached photo in the background and stores tags on the response", async () => {
    const qId = await createGatedQuestion();
    const res = await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth())
      .send({
        answers: [
          {
            clientMsgId: randomUUID(),
            questionId: qId,
            numericValue: 3,
            photoBase64: Buffer.from("fake-jpeg").toString("base64"),
            inputMode: "snap",
            language: "en",
            answeredAt: new Date().toISOString(),
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.results[0].status).toBe("credited"); // the response itself never waits on recognition

    let row: { recognized_tags: string[] | null; recognized_category_id: number | null } | undefined;
    for (let i = 0; i < 20; i++) {
      const { rows } = await pool.query(
        `SELECT recognized_tags, recognized_category_id FROM responses WHERE question_id = $1 AND alias_id = $2`,
        [qId, member.aliasId]
      );
      row = rows[0];
      if (row?.recognized_tags) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(row?.recognized_tags).toEqual(["rice", "bag"]);
    const { rows: catRows } = await pool.query(`SELECT slug FROM categories WHERE id = $1`, [
      row?.recognized_category_id,
    ]);
    expect(catRows[0].slug).toBe("rice");

    await deleteGatedQuestion(qId);
  });
});
