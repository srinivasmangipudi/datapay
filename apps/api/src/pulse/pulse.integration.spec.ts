import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { createTestMember, deleteTestMember, TestMember } from "../test-fixtures";

describe("Pulse — selection + atomic/idempotent answering (SPEC.md §15A/§15C)", () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  let member: TestMember;
  let riceQuestionId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
    member = await createTestMember(pool, jwt);

    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM questions WHERE text_en = 'Which rice does your household buy?'`
    );
    riceQuestionId = rows[0].id;
  });

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
});
