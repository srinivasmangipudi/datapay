import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";

describe("Organizations — self-serve signup, ops activation, and login's pending-approval message", () => {
  let app: INestApplication;
  let pool: Pool;
  let organizationId: string;
  const email = `signup-test-${randomUUID()}@example.com`;
  const password = "testpassword123";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM organizations WHERE email = $1`, [email]);
    await app.close();
    await pool.end();
  });

  it("signup lands the account inactive", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/org/signup")
      .send({ name: "Signup Test Org", email, password });
    expect(res.status).toBe(201);
    organizationId = res.body.id;

    const { rows } = await pool.query<{ active: boolean }>(
      `SELECT active FROM organizations WHERE id = $1`,
      [organizationId]
    );
    expect(rows[0].active).toBe(false);
  });

  it("login with the correct password against an inactive account gives a distinct pending-approval message, not the generic one", async () => {
    const res = await request(app.getHttpServer()).post("/v1/org/login").send({ email, password });
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toMatch(/awaiting approval/i);
  });

  it("login with the wrong password still gives the generic message — never reveals the account is real but inactive", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/org/login")
      .send({ email, password: "not-the-right-password" });
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toMatch(/incorrect email or password/i);
    expect(JSON.stringify(res.body)).not.toMatch(/awaiting approval/i);
  });

  it("login for an unknown email gives the exact same generic message", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/org/login")
      .send({ email: `nobody-${randomUUID()}@example.com`, password: "whatever12345" });
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toMatch(/incorrect email or password/i);
  });

  it("after ops activation, the same credentials that were 'awaiting approval' now log in", async () => {
    const activateRes = await request(app.getHttpServer()).post(
      `/v1/admin/organizations/${organizationId}/activate`
    );
    expect(activateRes.status).toBe(201);
    expect(activateRes.body.active).toBe(true);

    const loginRes = await request(app.getHttpServer()).post("/v1/org/login").send({ email, password });
    expect(loginRes.status).toBe(201);
    expect(loginRes.body.token).toBeTruthy();
  });
});
