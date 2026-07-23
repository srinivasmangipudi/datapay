import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
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

describe("Produce & Linkages (SPEC.md §12 Phase 6)", () => {
  let app: INestApplication;
  let pool: Pool;
  let vaultPool: Pool;
  let jwt: JwtService;
  let sugarcaneCategoryId: number;
  let ragiCategoryId: number;

  beforeAll(async () => {
    await startVaultForTest();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
    vaultPool = new Pool({ connectionString: process.env.VAULT_DATABASE_URL });

    const { rows } = await pool.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM produce_categories WHERE slug IN ('sugarcane', 'ragi')`
    );
    sugarcaneCategoryId = rows.find((r) => r.slug === "sugarcane")!.id;
    ragiCategoryId = rows.find((r) => r.slug === "ragi")!.id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    await vaultPool.end();
    stopVaultForTest();
  });

  async function cleanupMember(member: TestMember) {
    await pool.query(`DELETE FROM producer_payouts WHERE alias_id = $1`, [member.aliasId]);
    await deleteTestMember(pool, member.aliasId);
    await deleteTestMemberFromVault(vaultPool, member.aliasId);
  }

  async function producerMember(): Promise<TestMember> {
    const member = await createTestMember(pool, jwt);
    await registerTestMemberInVault(vaultPool, member);
    const auth = { Authorization: `Bearer ${member.token}` };
    const res = await request(app.getHttpServer())
      .post("/v1/produce/profile")
      .set(auth)
      .send({ kind: "farmer" });
    expect(res.status).toBe(201);
    return member;
  }

  async function listSugarcane(member: TestMember): Promise<number> {
    const auth = { Authorization: `Bearer ${member.token}` };
    const res = await request(app.getHttpServer())
      .post("/v1/produce/listings")
      .set(auth)
      .send({
        produceCategoryId: sugarcaneCategoryId,
        qty: 10,
        unit: "quintal",
        askingPricePaise: 500000,
      });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  it("rejects a listing before a producer profile exists", async () => {
    const member = await createTestMember(pool, jwt);
    const auth = { Authorization: `Bearer ${member.token}` };

    const res = await request(app.getHttpServer())
      .post("/v1/produce/listings")
      .set(auth)
      .send({ produceCategoryId: sugarcaneCategoryId, qty: 5, unit: "quintal" });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/producer profile/i);

    await deleteTestMember(pool, member.aliasId);
  });

  it("§12 Phase 6: matching ranks internal-collective first, ahead of a closer local processor", async () => {
    const member = await producerMember();
    const listingId = await listSugarcane(member);

    const matchRes = await request(app.getHttpServer())
      .post(`/v1/admin/produce-matching/run/${listingId}`)
      .send();
    expect(matchRes.status).toBe(201);
    expect(matchRes.body.linkagesCreated).toBe(2); // internal_collective + Kikkeri Jaggery Unit

    const auth = { Authorization: `Bearer ${member.token}` };
    const linkagesRes = await request(app.getHttpServer())
      .get(`/v1/produce/listings/${listingId}/linkages`)
      .set(auth);
    expect(linkagesRes.status).toBe(200);
    expect(linkagesRes.body).toHaveLength(2);
    expect(linkagesRes.body[0].buyerKind).toBe("internal_collective");
    expect(linkagesRes.body[1].buyerKind).toBe("local_processor");

    await cleanupMember(member);
  });

  it("§8 screen 5: identity stays hidden until the linkage reaches 'agreed'", async () => {
    const member = await producerMember();
    const listingId = await listSugarcane(member);
    await request(app.getHttpServer())
      .post(`/v1/admin/produce-matching/run/${listingId}`)
      .send();

    const auth = { Authorization: `Bearer ${member.token}` };
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM linkages WHERE listing_id = $1 ORDER BY id ASC LIMIT 1`,
      [listingId]
    );
    const linkageId = rows[0].id;

    const steps: Array<{ toState: string; expectDisclosed: boolean }> = [
      { toState: "producer_interested", expectDisclosed: false },
      { toState: "negotiating", expectDisclosed: false },
      { toState: "agreed", expectDisclosed: true },
      { toState: "completed", expectDisclosed: true },
    ];

    for (const step of steps) {
      const res = await request(app.getHttpServer())
        .post(`/v1/linkages/${linkageId}/advance`)
        .set(auth)
        .send({ toState: step.toState });
      expect(res.status).toBe(201);
      expect(res.body.identityDisclosed).toBe(step.expectDisclosed);
    }

    const { rows: after } = await pool.query<{ identity_disclosed_at: Date | null }>(
      `SELECT identity_disclosed_at FROM linkages WHERE id = $1`,
      [linkageId]
    );
    expect(after[0].identity_disclosed_at).not.toBeNull();

    await cleanupMember(member);
  });

  it("rejects an invalid state transition (e.g. suggested -> agreed, skipping negotiation)", async () => {
    const member = await producerMember();
    const listingId = await listSugarcane(member);
    await request(app.getHttpServer())
      .post(`/v1/admin/produce-matching/run/${listingId}`)
      .send();

    const auth = { Authorization: `Bearer ${member.token}` };
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM linkages WHERE listing_id = $1 ORDER BY id ASC LIMIT 1`,
      [listingId]
    );

    const res = await request(app.getHttpServer())
      .post(`/v1/linkages/${rows[0].id}/advance`)
      .set(auth)
      .send({ toState: "agreed" });
    expect(res.status).toBe(400);

    await cleanupMember(member);
  });

  it("returns approved value-add suggestions for ragi", async () => {
    const member = await createTestMember(pool, jwt);
    const auth = { Authorization: `Bearer ${member.token}` };

    const res = await request(app.getHttpServer())
      .get("/v1/produce/value-add")
      .set(auth)
      .query({ categoryId: ragiCategoryId });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body[0]).toHaveProperty("suggestionEn");

    await deleteTestMember(pool, member.aliasId);
  });

  it("§5A: producer payout succeeds via the sandbox UPI stub, and re-running the job never double-pays", async () => {
    const member = await producerMember();
    const auth = { Authorization: `Bearer ${member.token}` };

    const upiRes = await request(app.getHttpServer())
      .post("/v1/produce/payout-instrument")
      .set(auth)
      .send({ upiId: "testfarmer@upi" });
    expect(upiRes.status).toBe(201);

    const listingId = await listSugarcane(member);
    const matchRes = await request(app.getHttpServer())
      .post(`/v1/admin/produce-matching/run/${listingId}`)
      .send();
    const { rows: linkageRows } = await pool.query<{ id: number }>(
      `SELECT id FROM linkages WHERE listing_id = $1 ORDER BY id ASC LIMIT 1`,
      [listingId]
    );
    const linkageId = linkageRows[0].id;
    expect(matchRes.body.linkagesCreated).toBe(2);

    const interestedRes = await request(app.getHttpServer())
      .post(`/v1/linkages/${linkageId}/advance`)
      .set(auth)
      .send({ toState: "producer_interested" });
    expect(interestedRes.status).toBe(201);
    const negotiatingRes = await request(app.getHttpServer())
      .post(`/v1/linkages/${linkageId}/advance`)
      .set(auth)
      .send({ toState: "negotiating" });
    expect(negotiatingRes.status).toBe(201);
    const agreedRes = await request(app.getHttpServer())
      .post(`/v1/linkages/${linkageId}/advance`)
      .set(auth)
      .send({ toState: "agreed" });
    expect(agreedRes.status).toBe(201);

    const firstRun = await request(app.getHttpServer())
      .post("/v1/admin/producer-payouts/run")
      .send();
    expect(firstRun.status).toBe(201);
    expect(firstRun.body.paid).toBeGreaterThanOrEqual(1);

    const { rows: payoutRows } = await pool.query<{ status: string; upi_ref: string | null }>(
      `SELECT status, upi_ref FROM producer_payouts WHERE linkage_id = $1`,
      [linkageId]
    );
    expect(payoutRows).toHaveLength(1);
    expect(payoutRows[0].status).toBe("paid");
    expect(payoutRows[0].upi_ref).toMatch(/^sandbox-/);

    const secondRun = await request(app.getHttpServer())
      .post("/v1/admin/producer-payouts/run")
      .send();
    expect(secondRun.status).toBe(201);

    const { rows: countAfter } = await pool.query<{ count: string }>(
      `SELECT count(*) FROM producer_payouts WHERE linkage_id = $1`,
      [linkageId]
    );
    expect(Number(countAfter[0].count)).toBe(1); // idempotent — no duplicate payout row

    await cleanupMember(member);
  });

  it("§19C: a low-trust producer's payout is held for review, never auto-paid or dropped", async () => {
    const member = await producerMember();
    await pool.query(`UPDATE members SET trust_score = 0.3 WHERE alias_id = $1`, [member.aliasId]);
    const auth = { Authorization: `Bearer ${member.token}` };

    await request(app.getHttpServer())
      .post("/v1/produce/payout-instrument")
      .set(auth)
      .send({ upiId: "lowtrust@upi" });

    const listingId = await listSugarcane(member);
    await request(app.getHttpServer()).post(`/v1/admin/produce-matching/run/${listingId}`).send();
    const { rows: linkageRows } = await pool.query<{ id: number }>(
      `SELECT id FROM linkages WHERE listing_id = $1 ORDER BY id ASC LIMIT 1`,
      [listingId]
    );
    const linkageId = linkageRows[0].id;

    for (const toState of ["producer_interested", "negotiating", "agreed"]) {
      const res = await request(app.getHttpServer())
        .post(`/v1/linkages/${linkageId}/advance`)
        .set(auth)
        .send({ toState });
      expect(res.status).toBe(201);
    }

    const runRes = await request(app.getHttpServer()).post("/v1/admin/producer-payouts/run").send();
    expect(runRes.status).toBe(201);
    expect(runRes.body.review).toBeGreaterThanOrEqual(1);
    expect(runRes.body.batchId).toMatch(/^[0-9a-f-]{36}$/);

    const { rows: payoutRows } = await pool.query<{
      status: string;
      upi_ref: string | null;
      batch_id: string;
    }>(`SELECT status, upi_ref, batch_id FROM producer_payouts WHERE linkage_id = $1`, [linkageId]);
    expect(payoutRows).toHaveLength(1);
    expect(payoutRows[0].status).toBe("review");
    expect(payoutRows[0].upi_ref).toBeNull(); // never attempted — no fabricated payment claim
    expect(payoutRows[0].batch_id).toBe(runRes.body.batchId);

    await cleanupMember(member);
  });
});
