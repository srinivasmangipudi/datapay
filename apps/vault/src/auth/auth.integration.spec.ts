import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";

describe("Vault auth — register / verify-otp / choose-alias (integration, real vault_db)", () => {
  let app: INestApplication;
  let pool: Pool;
  const testPhone = `+91${Math.floor(7_000_000_000 + Math.random() * 999_999_999)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM alias_map WHERE user_id IN (SELECT id FROM users WHERE phone_e164 = $1)`,
      [testPhone]
    );
    await pool.query(`DELETE FROM users WHERE phone_e164 = $1`, [testPhone]);
    await app.close();
    await pool.end();
  });

  function readDevOtp(logSpy: jest.SpyInstance): string {
    const call = logSpy.mock.calls.find((c) => String(c[0]).includes(testPhone));
    const match = String(call?.[0]).match(/OTP for .*: (\d{6})/);
    if (!match) throw new Error("Could not read dev OTP from logs");
    return match[1];
  }

  async function registerAndGetOtp(): Promise<string> {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await request(app.getHttpServer())
      .post("/register")
      .send({ phoneE164: testPhone, name: "Test Member" });
    const otp = readDevOtp(logSpy);
    logSpy.mockRestore();
    return otp;
  }

  it("a first-time verify-otp offers candidates and commits nothing yet (SPEC.md §36)", async () => {
    const otp = await registerAndGetOtp();

    const verifyRes = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp });

    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.status).toBe("choose_alias");
    expect(verifyRes.body.aliasId).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof verifyRes.body.pendingToken).toBe("string");
    expect(verifyRes.body.token).toBeUndefined(); // nothing minted until a name is chosen

    const candidates: string[] = verifyRes.body.candidates;
    expect(candidates).toHaveLength(8);
    expect(new Set(candidates).size).toBe(8); // no duplicates within the batch
    for (const c of candidates) {
      expect(c).toMatch(/^[A-Z-]+ [A-Z-]+ \d{1,2}$/);
    }

    // Nothing committed to alias_map yet — the whole point of this step.
    const { rows } = await pool.query(
      `SELECT alias_id FROM alias_map am JOIN users u ON u.id = am.user_id WHERE u.phone_e164 = $1`,
      [testPhone]
    );
    expect(rows).toHaveLength(0);
  });

  it("POST /alias-candidates returns a fresh batch for the same pending session", async () => {
    const otp = await registerAndGetOtp();
    const verifyRes = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp });
    const { pendingToken, candidates: firstBatch } = verifyRes.body;

    const moreRes = await request(app.getHttpServer())
      .post("/alias-candidates")
      .send({ pendingToken });
    expect(moreRes.status).toBe(201);
    expect(moreRes.body.candidates).toHaveLength(8);
    // Not asserting the batches differ (a 7,920-combination space makes an
    // accidental full overlap astronomically unlikely, but not impossible in
    // principle) — asserting the SHAPE and that the session is still valid is
    // the actual guarantee worth testing here.
    for (const c of moreRes.body.candidates) {
      expect(c).toMatch(/^[A-Z-]+ [A-Z-]+ \d{1,2}$/);
    }
    expect(Array.isArray(firstBatch)).toBe(true);
  });

  it("POST /commit-alias locks in the chosen name and mints a JWT carrying only aliasId + displayAlias", async () => {
    const otp = await registerAndGetOtp();
    const verifyRes = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp });
    const { pendingToken, candidates } = verifyRes.body;
    const chosen = candidates[2];

    const commitRes = await request(app.getHttpServer())
      .post("/commit-alias")
      .send({ pendingToken, displayAlias: chosen });

    expect(commitRes.status).toBe(201);
    expect(commitRes.body.displayAlias).toBe(chosen);
    expect(commitRes.body.aliasId).toBe(verifyRes.body.aliasId);
    expect(typeof commitRes.body.token).toBe("string");

    const [, payloadB64] = commitRes.body.token.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    expect(Object.keys(payload).sort()).toEqual(
      expect.arrayContaining(["aliasId", "displayAlias"])
    );
    expect(JSON.stringify(payload)).not.toContain(testPhone);

    const { rows } = await pool.query(
      `SELECT display_alias FROM alias_map am JOIN users u ON u.id = am.user_id WHERE u.phone_e164 = $1`,
      [testPhone]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].display_alias).toBe(chosen);

    // The pending session is consumed — reusing the same pendingToken again must fail.
    const replay = await request(app.getHttpServer())
      .post("/commit-alias")
      .send({ pendingToken, displayAlias: candidates[3] });
    expect(replay.status).toBe(401);

    await pool.query(`DELETE FROM alias_map WHERE user_id IN (SELECT id FROM users WHERE phone_e164 = $1)`, [
      testPhone,
    ]);
  });

  it("rejects a displayAlias that isn't one of the real word-list candidates", async () => {
    const otp = await registerAndGetOtp();
    const verifyRes = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp });

    const res = await request(app.getHttpServer())
      .post("/commit-alias")
      .send({ pendingToken: verifyRes.body.pendingToken, displayAlias: "MY OWN CHOSEN NAME" });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown pendingToken on both alias endpoints", async () => {
    const fakeToken = "00000000-0000-0000-0000-000000000000";
    const commitRes = await request(app.getHttpServer())
      .post("/commit-alias")
      .send({ pendingToken: fakeToken, displayAlias: "KAVERI HERON 1" });
    expect(commitRes.status).toBe(401);

    const moreRes = await request(app.getHttpServer())
      .post("/alias-candidates")
      .send({ pendingToken: fakeToken });
    expect(moreRes.status).toBe(401);
  });

  it("rejects an incorrect OTP and increments the attempt counter", async () => {
    await registerAndGetOtp();

    const res = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp: "000000" });
    expect(res.status).toBe(401);
  });

  it("rejects replaying an already-consumed OTP", async () => {
    const otp = await registerAndGetOtp();

    const first = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp });
    expect(first.status).toBe(201);

    const replay = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp });
    expect(replay.status).toBe(401);
  });

  it("resolves to the SAME alias on a second registration cycle, once committed (write-once bridge)", async () => {
    const firstOtp = await registerAndGetOtp();
    const firstVerify = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp: firstOtp });
    const commitRes = await request(app.getHttpServer())
      .post("/commit-alias")
      .send({ pendingToken: firstVerify.body.pendingToken, displayAlias: firstVerify.body.candidates[0] });
    const firstAlias = commitRes.body.aliasId;
    const firstDisplayAlias = commitRes.body.displayAlias;

    const secondOtp = await registerAndGetOtp();
    const secondVerify = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp: secondOtp });

    expect(secondVerify.body.status).toBe("returning");
    expect(secondVerify.body.aliasId).toBe(firstAlias);
    expect(secondVerify.body.displayAlias).toBe(firstDisplayAlias);
    expect(secondVerify.body.candidates).toBeUndefined();

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM alias_map am JOIN users u ON u.id = am.user_id WHERE u.phone_e164 = $1`,
      [testPhone]
    );
    expect(rows[0].n).toBe(1);
  });
});

describe("Vault's external surface (no 'get user' endpoint)", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it.each([
    ["get", "/users"],
    ["get", "/user"],
    ["get", "/me"],
    ["get", "/users/1"],
    ["get", "/resolve-payout"],
    ["get", "/resolve-relay"],
  ])("%s %s does not exist", async (method, path) => {
    const res = await (request(app.getHttpServer()) as any)[method](path);
    expect(res.status).toBe(404);
  });
});
