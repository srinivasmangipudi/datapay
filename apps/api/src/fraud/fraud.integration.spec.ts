import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { createTestMember, deleteTestMember, TestMember } from "../test-fixtures";

describe("Fraud/quality engine v1 (SPEC.md §6 / §19)", () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  let sugarQuestionId: number;
  let sugarYesOptionId: number;
  let sugarMaybeOptionId: number;
  let riceQuestionId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);

    const { rows: qRows } = await pool.query<{ id: number }>(
      `SELECT id FROM questions WHERE type = 'intent_window' LIMIT 1`
    );
    sugarQuestionId = qRows[0].id;
    const { rows: optRows } = await pool.query<{ id: number; label_en: string }>(
      `SELECT id, label_en FROM question_options WHERE question_id = $1`,
      [sugarQuestionId]
    );
    sugarYesOptionId = optRows.find((o) => o.label_en === "Yes")!.id;
    sugarMaybeOptionId = optRows.find((o) => o.label_en === "Maybe")!.id;

    const { rows: riceRows } = await pool.query<{ id: number }>(
      `SELECT id FROM questions WHERE text_en = 'Which rice does your household buy?'`
    );
    riceQuestionId = riceRows[0].id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  async function cleanupMember(member: TestMember) {
    await pool.query(`DELETE FROM quality_flags WHERE alias_id = $1`, [member.aliasId]);
    await pool.query(`DELETE FROM device_fingerprints WHERE alias_id = $1`, [member.aliasId]);
    await deleteTestMember(pool, member.aliasId);
  }

  function auth(member: TestMember) {
    return { Authorization: `Bearer ${member.token}` };
  }

  function answerPayload(
    questionId: number,
    optionIds: number[],
    overrides: Partial<{ clientMsgId: string }> = {}
  ) {
    return {
      clientMsgId: overrides.clientMsgId ?? randomUUID(),
      questionId,
      optionIds,
      inputMode: "tap",
      language: "en",
      answeredAt: new Date().toISOString(),
    };
  }

  it("§19A: velocity cap rejects once an alias crosses the 24h response threshold", async () => {
    const member = await createTestMember(pool, jwt);

    // Seed 60 responses directly — cheaper than 60 real HTTP round-trips,
    // and the cap only cares about the count, not how the rows got there.
    for (let i = 0; i < 60; i++) {
      await pool.query(
        `INSERT INTO responses (alias_id, question_id, option_ids, input_mode, language, answered_at, client_msg_id, created_at)
         VALUES ($1, $2, '{}', 'tap', 'en', now(), $3, now())`,
        [member.aliasId, riceQuestionId, randomUUID()]
      );
    }

    const res = await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth(member))
      .send({ answers: [answerPayload(riceQuestionId, [])] });

    expect(res.status).toBe(201);
    expect(res.body.results[0].status).toBe("rejected_velocity_cap");

    const { rows: flags } = await pool.query(
      `SELECT rule FROM quality_flags WHERE alias_id = $1 AND rule = 'velocity_cap'`,
      [member.aliasId]
    );
    expect(flags.length).toBeGreaterThanOrEqual(1);

    await cleanupMember(member);
  });

  it("§19A: a conflicting intent declaration within 24h flags a contradiction and decrements trust_score", async () => {
    const member = await createTestMember(pool, jwt);

    const firstRes = await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth(member))
      .send({ answers: [answerPayload(sugarQuestionId, [sugarYesOptionId])] });
    expect(firstRes.status).toBe(201);
    expect(firstRes.body.results[0].status).toBe("credited");

    const { rows: trustBefore } = await pool.query<{ trust_score: string }>(
      `SELECT trust_score FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    expect(Number(trustBefore[0].trust_score)).toBe(1);

    const secondRes = await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth(member))
      .send({ answers: [answerPayload(sugarQuestionId, [sugarMaybeOptionId])] });
    expect(secondRes.status).toBe(201);
    expect(secondRes.body.results[0].status).toBe("credited"); // flagged, never blocked

    const { rows: flags } = await pool.query(
      `SELECT rule FROM quality_flags WHERE alias_id = $1 AND rule = 'intent_contradiction'`,
      [member.aliasId]
    );
    expect(flags).toHaveLength(1);

    const { rows: trustAfter } = await pool.query<{ trust_score: string }>(
      `SELECT trust_score FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    expect(Number(trustAfter[0].trust_score)).toBeLessThan(1);

    const { rows: intents } = await pool.query(
      `SELECT strength FROM intents WHERE alias_id = $1 ORDER BY declared_at ASC`,
      [member.aliasId]
    );
    expect(intents).toHaveLength(2); // both recorded — flagged, not dropped

    await cleanupMember(member);
  });

  it("§19A: two aliases sharing a device fingerprint both get flagged", async () => {
    const memberA = await createTestMember(pool, jwt);
    const memberB = await createTestMember(pool, jwt);
    const sharedFingerprint = `raw-fingerprint-${randomUUID()}`;

    const resA = await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth(memberA))
      .send({ answers: [answerPayload(riceQuestionId, [])], deviceFingerprint: sharedFingerprint });
    expect(resA.status).toBe(201);

    const resB = await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth(memberB))
      .send({ answers: [answerPayload(riceQuestionId, [])], deviceFingerprint: sharedFingerprint });
    expect(resB.status).toBe(201);

    const { rows: flagsA } = await pool.query(
      `SELECT rule, detail FROM quality_flags WHERE alias_id = $1 AND rule = 'device_dedup'`,
      [memberA.aliasId]
    );
    const { rows: flagsB } = await pool.query(
      `SELECT rule, detail FROM quality_flags WHERE alias_id = $1 AND rule = 'device_dedup'`,
      [memberB.aliasId]
    );
    expect(flagsA).toHaveLength(1);
    expect(flagsB).toHaveLength(1);

    await cleanupMember(memberA);
    await cleanupMember(memberB);
  });

  it("§19A: a distinct fingerprint never flags a lone alias", async () => {
    const member = await createTestMember(pool, jwt);

    await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth(member))
      .send({
        answers: [answerPayload(riceQuestionId, [])],
        deviceFingerprint: `raw-fingerprint-${randomUUID()}`,
      });

    const { rows: flags } = await pool.query(
      `SELECT rule FROM quality_flags WHERE alias_id = $1 AND rule = 'device_dedup'`,
      [member.aliasId]
    );
    expect(flags).toHaveLength(0);

    await cleanupMember(member);
  });

  it("§19C: verifying a snap bumps trust_score, and re-verifying is rejected", async () => {
    const member = await createTestMember(pool, jwt);
    await pool.query(`UPDATE members SET trust_score = 0.5 WHERE alias_id = $1`, [member.aliasId]);

    const snapRes = await request(app.getHttpServer())
      .post("/v1/snaps")
      .set(auth(member))
      .send({
        clientMsgId: randomUUID(),
        imageBase64: Buffer.from("fake-jpeg-bytes").toString("base64"),
        capturedAt: new Date().toISOString(),
      });
    expect(snapRes.status).toBe(201);
    const snapId = snapRes.body.snapId;

    const verifyRes = await request(app.getHttpServer()).post(`/v1/admin/snaps/${snapId}/verify`).send();
    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.aliasId).toBe(member.aliasId);

    const { rows: trustAfter } = await pool.query<{ trust_score: string }>(
      `SELECT trust_score FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    expect(Number(trustAfter[0].trust_score)).toBeCloseTo(0.55, 5);

    const { rows: snapState } = await pool.query<{ state: string }>(
      `SELECT state FROM snaps WHERE id = $1`,
      [snapId]
    );
    expect(snapState[0].state).toBe("ops_verified");

    const reverify = await request(app.getHttpServer()).post(`/v1/admin/snaps/${snapId}/verify`).send();
    expect(reverify.status).toBe(400);

    await cleanupMember(member);
  });
});
