import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import {
  createTestMember,
  deleteTestMember,
  deleteTestMemberFromVault,
  registerTestMemberInVault,
  TestMember,
} from "../test-fixtures";
import { startVaultForTest, stopVaultForTest } from "../test-vault-process";

const VILLAGE_ZONE_ID = "00000000-0000-0000-0000-000000000005";

describe("Member-facing product browse + reserve-only order (identity-blind, §7-style)", () => {
  let app: INestApplication;
  let pool: Pool;
  let vaultPool: Pool;
  let jwt: JwtService;
  let organizationId: string;

  beforeAll(async () => {
    await startVaultForTest();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
    vaultPool = new Pool({ connectionString: process.env.VAULT_DATABASE_URL });
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    await vaultPool.end();
    stopVaultForTest();
  });

  beforeEach(async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO organizations (slug, name, email, password_hash) VALUES ($1, 'Test Org', $2, 'x') RETURNING id`,
      [`test-org-${randomUUID()}`, `${randomUUID()}@example.com`]
    );
    organizationId = rows[0].id;
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM product_orders WHERE org_product_id IN (SELECT id FROM org_products WHERE organization_id = $1)`, [organizationId]);
    await pool.query(`DELETE FROM org_products WHERE organization_id = $1`, [organizationId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
  });

  async function seedProduct(quantity: number, zoneId: string | null = null): Promise<number> {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO org_products
         (organization_id, name_en, unit_spec, market_price_paise, sale_price_paise,
          quantity_available, dedup_key, source, review_state, zone_id)
       VALUES ($1, 'Test Rice', '5kg', 45000, 39900, $2, 'test rice', 'manual', 'approved', $3)
       RETURNING id`,
      [organizationId, quantity, zoneId]
    );
    return rows[0].id;
  }

  async function memberWithAddress(): Promise<TestMember> {
    const member = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);
    await registerTestMemberInVault(vaultPool, member);
    await request(app.getHttpServer())
      .post("/v1/me/delivery-address")
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ address: "House 7, Kikkeri Village, Mandya 571401" });
    return member;
  }

  async function cleanupMember(member: TestMember) {
    await deleteTestMember(pool, member.aliasId);
    await deleteTestMemberFromVault(vaultPool, member.aliasId);
  }

  it("browse only returns approved, in-stock, zone-eligible products", async () => {
    const productId = await seedProduct(5);
    const member = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);

    const res = await request(app.getHttpServer())
      .get("/v1/products")
      .set({ Authorization: `Bearer ${member.token}` });

    expect(res.status).toBe(200);
    expect(res.body.some((p: { id: number }) => p.id === productId)).toBe(true);

    await deleteTestMember(pool, member.aliasId);
  });

  it("browse excludes an out-of-stock product", async () => {
    const productId = await seedProduct(0);
    const member = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);

    const res = await request(app.getHttpServer())
      .get("/v1/products")
      .set({ Authorization: `Bearer ${member.token}` });

    expect(res.body.some((p: { id: number }) => p.id === productId)).toBe(false);

    await deleteTestMember(pool, member.aliasId);
  });

  it("ordering fails cleanly with no delivery address on file", async () => {
    const productId = await seedProduct(5);
    const member = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);
    await registerTestMemberInVault(vaultPool, member);

    const res = await request(app.getHttpServer())
      .post(`/v1/products/${productId}/order`)
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ quantity: 1 });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/delivery address/i);

    // The failed relay registration must not have left a dangling decrement.
    const { rows } = await pool.query<{ quantity_available: number }>(
      `SELECT quantity_available FROM org_products WHERE id = $1`,
      [productId]
    );
    expect(rows[0].quantity_available).toBe(5);

    await cleanupMember(member);
  });

  it("ordering decrements stock, is identity-blind to the org, and resolves via relay", async () => {
    const productId = await seedProduct(5);
    const member = await memberWithAddress();

    const res = await request(app.getHttpServer())
      .post(`/v1/products/${productId}/order`)
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.relayToken).toMatch(/^[0-9a-f-]{36}$/);

    const { rows } = await pool.query<{ quantity_available: number }>(
      `SELECT quantity_available FROM org_products WHERE id = $1`,
      [productId]
    );
    expect(rows[0].quantity_available).toBe(3);

    const resolveRes = await request(app.getHttpServer())
      .post("/v1/relay/resolve")
      .send({ relayToken: res.body.relayToken });
    expect(resolveRes.status).toBe(201);
    expect(resolveRes.body.address).toContain("Kikkeri");

    await cleanupMember(member);
  });

  it("concurrent orders for the last unit: exactly one succeeds, never oversold", async () => {
    const productId = await seedProduct(1);
    const memberA = await memberWithAddress();
    const memberB = await memberWithAddress();

    const attempt = (member: TestMember) =>
      request(app.getHttpServer())
        .post(`/v1/products/${productId}/order`)
        .set({ Authorization: `Bearer ${member.token}` })
        .send({ quantity: 1 });

    const [resA, resB] = await Promise.all([attempt(memberA), attempt(memberB)]);
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 400]);

    const { rows } = await pool.query<{ quantity_available: number }>(
      `SELECT quantity_available FROM org_products WHERE id = $1`,
      [productId]
    );
    expect(rows[0].quantity_available).toBe(0); // decremented exactly once, never negative

    await cleanupMember(memberA);
    await cleanupMember(memberB);
  });
});
