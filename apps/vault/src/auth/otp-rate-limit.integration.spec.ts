import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";

function randomPhone(): string {
  return `+91${Math.floor(7_000_000_000 + Math.random() * 999_999_999)}`;
}

describe("Vault auth — OTP rate limiting (integration, real vault_db)", () => {
  let app: INestApplication;
  let pool: Pool;
  const testPhone = randomPhone();
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    // Rate limiting is deliberately skipped when NODE_ENV === 'test' (see
    // auth.service.ts) so the rest of the suite can re-register freely —
    // this file is the one place that actually exercises the real limiter.
    process.env.NODE_ENV = "production";
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await pool.query(
      `DELETE FROM alias_map WHERE user_id IN (SELECT id FROM users WHERE phone_e164 = $1)`,
      [testPhone]
    );
    await pool.query(`DELETE FROM users WHERE phone_e164 = $1`, [testPhone]);
    await app.close();
    await pool.end();
  });

  it("blocks an immediate resend for the same number (cooldown)", async () => {
    const first = await request(app.getHttpServer())
      .post("/register")
      .send({ phoneE164: testPhone, name: "Rate Limit Test" });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post("/register")
      .send({ phoneE164: testPhone, name: "Rate Limit Test" });
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/wait/i);
  });

  it("caps total requests per hour for the same number", async () => {
    const otherPhone = randomPhone();
    // Seed otp_codes rows directly, well outside the cooldown window, so the
    // hourly cap trips in isolation rather than the cooldown check.
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone_e164, name) VALUES ($1, $2) RETURNING id`,
      [otherPhone, "Hourly Cap Test"]
    );
    const userId = rows[0].id;
    for (let i = 0; i < 15; i++) {
      await pool.query(
        `INSERT INTO otp_codes (user_id, code_hash, code_salt, expires_at, created_at)
         VALUES ($1, 'x', 'y', now() + interval '5 minutes', now() - interval '10 minutes')`,
        [userId]
      );
    }

    const res = await request(app.getHttpServer())
      .post("/register")
      .send({ phoneE164: otherPhone, name: "Hourly Cap Test" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too many/i);

    await pool.query(`DELETE FROM otp_codes WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });
});
