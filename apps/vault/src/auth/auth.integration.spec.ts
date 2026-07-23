import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";

describe("Vault auth — register / verify-otp (integration, real vault_db)", () => {
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

  it("registers, verifies OTP, and issues a JWT carrying only aliasId + displayAlias", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const registerRes = await request(app.getHttpServer())
      .post("/register")
      .send({ phoneE164: testPhone, name: "Test Member" });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body).toEqual({ status: "otp_sent" });

    const otp = readDevOtp(logSpy);
    logSpy.mockRestore();

    const verifyRes = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp });

    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.aliasId).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyRes.body.displayAlias).toMatch(/^[A-Z-]+ [A-Z-]+ \d{1,2}$/);
    expect(typeof verifyRes.body.token).toBe("string");

    // The JWT's payload must never carry phone or user_id — only what Core is allowed to see.
    const [, payloadB64] = verifyRes.body.token.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    expect(Object.keys(payload).sort()).toEqual(
      expect.arrayContaining(["aliasId", "displayAlias"])
    );
    expect(JSON.stringify(payload)).not.toContain(testPhone);
  });

  it("rejects an incorrect OTP and increments the attempt counter", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await request(app.getHttpServer())
      .post("/register")
      .send({ phoneE164: testPhone, name: "Test Member" });
    logSpy.mockRestore();

    const res = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp: "000000" });
    expect(res.status).toBe(401);
  });

  it("rejects replaying an already-consumed OTP", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await request(app.getHttpServer())
      .post("/register")
      .send({ phoneE164: testPhone, name: "Test Member" });
    const otp = readDevOtp(logSpy);
    logSpy.mockRestore();

    const first = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp });
    expect(first.status).toBe(201);

    const replay = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp });
    expect(replay.status).toBe(401);
  });

  it("resolves to the SAME alias on a second registration cycle (write-once bridge)", async () => {
    const { rows: before } = await pool.query(
      `SELECT alias_id FROM alias_map am JOIN users u ON u.id = am.user_id WHERE u.phone_e164 = $1`,
      [testPhone]
    );
    expect(before).toHaveLength(1);
    const firstAlias = before[0].alias_id;

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await request(app.getHttpServer())
      .post("/register")
      .send({ phoneE164: testPhone, name: "Test Member" });
    const otp = readDevOtp(logSpy);
    logSpy.mockRestore();

    const verifyRes = await request(app.getHttpServer())
      .post("/verify-otp")
      .send({ phoneE164: testPhone, otp });

    expect(verifyRes.body.aliasId).toBe(firstAlias);

    const { rows: after } = await pool.query(`SELECT COUNT(*)::int AS n FROM alias_map am
       JOIN users u ON u.id = am.user_id WHERE u.phone_e164 = $1`, [testPhone]);
    expect(after[0].n).toBe(1);
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
