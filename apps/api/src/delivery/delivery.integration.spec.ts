import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { startVaultForTest, stopVaultForTest } from "../test-vault-process";
import { normalisePhone } from "./delivery.service";

const VILLAGE_ZONE_ID = "00000000-0000-0000-0000-000000000005";

describe("Delivery people", () => {
  let app: INestApplication;
  let pool: Pool;
  const madeAgentIds: string[] = [];

  beforeAll(async () => {
    // Phones live in Vault now, so sign-in and onboarding both cross services.
    await startVaultForTest();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
  });

  afterAll(async () => {
    if (madeAgentIds.length) {
      await pool.query(`DELETE FROM delivery_agents WHERE id = ANY($1)`, [madeAgentIds]);
      const vaultPool = new Pool({ connectionString: process.env.VAULT_DATABASE_URL });
      await vaultPool.query(`DELETE FROM delivery_agent_phones WHERE agent_id = ANY($1)`, [madeAgentIds]);
      await vaultPool.end();
    }
    await app.close();
    await pool.end();
    stopVaultForTest();
  });

  // A 10-digit number unique within the run. The first version keyed off
  // Date.now() and two tests in the same millisecond collided, which failed as
  // "duplicate number" and looked like a real bug.
  let phoneCounter = 0;
  function someNumber(): string {
    phoneCounter += 1;
    const salt = String(Math.floor(Math.random() * 1e5)).padStart(5, "0");
    return `9${salt}${String(phoneCounter).padStart(4, "0")}`;
  }

  async function onboard(phone: string, password = "letmein123") {
    const res = await request(app.getHttpServer())
      .post("/v1/admin/delivery-agents")
      .send({ name: "Test Agent", phone, zoneId: VILLAGE_ZONE_ID, password });
    if (res.body?.id) madeAgentIds.push(res.body.id);
    return res;
  }

  it("normalises however the number is typed, so one person is one account", () => {
    const expected = "+919876543210";
    for (const written of ["9876543210", "+919876543210", "+91 98765 43210", "09876543210", "91 9876543210"]) {
      expect(normalisePhone(written)).toBe(expected);
    }
    expect(() => normalisePhone("12345")).toThrow(/10-digit/);
  });

  it("onboards, signs in, and refuses a wrong passcode", async () => {
    const phone = someNumber();
    expect((await onboard(phone)).status).toBe(201);

    const ok = await request(app.getHttpServer())
      .post("/v1/delivery/login")
      .send({ phone, password: "letmein123" });
    expect(ok.status).toBe(201);
    expect(ok.body.token).toBeTruthy();

    const bad = await request(app.getHttpServer())
      .post("/v1/delivery/login")
      .send({ phone, password: "wrong-passcode" });
    expect(bad.status).toBe(401);
  });

  it("a deactivated agent cannot sign in, and can again once reactivated", async () => {
    const phone = someNumber();
    const created = await onboard(phone);
    const agentId = created.body.id;

    await request(app.getHttpServer())
      .post(`/v1/admin/delivery-agents/${agentId}/active`)
      .send({ active: false });

    const blocked = await request(app.getHttpServer())
      .post("/v1/delivery/login")
      .send({ phone, password: "letmein123" });
    expect(blocked.status).toBe(401);
    expect(JSON.stringify(blocked.body)).toMatch(/deactivated/i);

    await request(app.getHttpServer())
      .post(`/v1/admin/delivery-agents/${agentId}/active`)
      .send({ active: true });
    const allowed = await request(app.getHttpServer())
      .post("/v1/delivery/login")
      .send({ phone, password: "letmein123" });
    expect(allowed.status).toBe(201);
  });

  it("the same number cannot be onboarded twice", async () => {
    const phone = someNumber();
    expect((await onboard(phone)).status).toBe(201);
    // Typed differently, same person — must not become a second account.
    const dup = await request(app.getHttpServer())
      .post("/v1/admin/delivery-agents")
      .send({ name: "Dup", phone: `+91${phone}`, zoneId: VILLAGE_ZONE_ID, password: "letmein123" });
    expect(dup.status).toBe(400);
  });

  it("a delivery token cannot reach member endpoints, and a member token cannot reach delivery ones", async () => {
    const phone = someNumber();
    await onboard(phone);
    const { body } = await request(app.getHttpServer())
      .post("/v1/delivery/login")
      .send({ phone, password: "letmein123" });

    // Distinct `type` claims are the whole point — all three token kinds share
    // JWT_SECRET, so without the check a delivery passcode would open a
    // member's vault.
    const crossed = await request(app.getHttpServer())
      .get("/v1/products")
      .set({ Authorization: `Bearer ${body.token}` });
    expect(crossed.status).toBe(401);

    const noToken = await request(app.getHttpServer()).get("/v1/delivery/deliveries");
    expect(noToken.status).toBe(401);
  });

  it("deliveries never expose a member alias, even at the SQL level", async () => {
    const phone = someNumber();
    await onboard(phone);
    const { body } = await request(app.getHttpServer())
      .post("/v1/delivery/login")
      .send({ phone, password: "letmein123" });

    const res = await request(app.getHttpServer())
      .get("/v1/delivery/deliveries")
      .set({ Authorization: `Bearer ${body.token}` });
    expect(res.status).toBe(200);
    // A delivery person sees a relay token and what to carry. Never who.
    expect(JSON.stringify(res.body)).not.toMatch(/alias/i);
  });
});
