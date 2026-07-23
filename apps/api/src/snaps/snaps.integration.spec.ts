import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { createTestMember, deleteTestMember, TestMember } from "../test-fixtures";

describe("Snaps — atomic + idempotent token earning (SPEC.md §15A/§15C)", () => {
  let app: INestApplication;
  let pool: Pool;
  let member: TestMember;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    const jwt = app.get(JwtService);
    member = await createTestMember(pool, jwt);
  });

  afterAll(async () => {
    await deleteTestMember(pool, member.aliasId);
    await app.close();
    await pool.end();
  });

  function auth() {
    return { Authorization: `Bearer ${member.token}` };
  }

  it("credits tokens on first submission and lists the snap", async () => {
    const before = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    const clientMsgId = randomUUID();

    const res = await request(app.getHttpServer()).post("/v1/snaps").set(auth()).send({
      clientMsgId,
      imageBase64: Buffer.from("fake-jpeg-bytes").toString("base64"),
      capturedAt: new Date().toISOString(),
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("credited");

    const after = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    expect(after.rows[0].token_balance).toBeGreaterThan(before.rows[0].token_balance);

    const list = await request(app.getHttpServer()).get("/v1/snaps").set(auth());
    expect(list.body.some((s: { id: number }) => s.id === res.body.snapId)).toBe(true);
  });

  it("replaying the same client_msg_id is a clean no-op", async () => {
    const clientMsgId = randomUUID();
    const payload = {
      clientMsgId,
      imageBase64: Buffer.from("fake-jpeg-bytes-2").toString("base64"),
      capturedAt: new Date().toISOString(),
    };

    const first = await request(app.getHttpServer()).post("/v1/snaps").set(auth()).send(payload);
    expect(first.body.status).toBe("credited");

    const replay = await request(app.getHttpServer()).post("/v1/snaps").set(auth()).send(payload);
    expect(replay.body.status).toBe("already_synced");

    const { rows } = await pool.query(
      `SELECT id FROM snaps WHERE alias_id = $1 AND client_msg_id = $2`,
      [member.aliasId, clientMsgId]
    );
    expect(rows).toHaveLength(1);
  });
});
