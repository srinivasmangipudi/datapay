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

const TOKEN_VALUE_PAISE = 24; // seeded rice offer's offer_token_terms

// Real pilot data (and other suites' members) may already exist, so every
// assertion here is a DELTA across a live earn→redeem→deliver cycle, never
// an absolute count — same lesson as isEligibleForPulseToday/the fund test's
// before/after balance check.
describe("Admin overview — the 'main company page' numbers (SPEC.md §40)", () => {
  let app: INestApplication;
  let pool: Pool;
  let vaultPool: Pool;
  let jwt: JwtService;
  let riceOfferId: number;
  let riceCategoryId: number;

  beforeAll(async () => {
    await startVaultForTest();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
    vaultPool = new Pool({ connectionString: process.env.VAULT_DATABASE_URL });

    const { rows } = await pool.query<{ id: number; category_id: number }>(
      `SELECT id, category_id FROM offers o JOIN products p ON p.product_code = o.product_code
       WHERE o.product_code = 'rice-sona-masuri-25kg'`
    );
    riceOfferId = rows[0].id;
    riceCategoryId = rows[0].category_id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    await vaultPool.end();
    stopVaultForTest();
  });

  async function cleanupMember(member: TestMember) {
    await deleteTestMember(pool, member.aliasId);
    await deleteTestMemberFromVault(vaultPool, member.aliasId);
  }

  async function memberWithAddressAndTokens(tokens: number): Promise<TestMember> {
    const member = await createTestMember(pool, jwt);
    await registerTestMemberInVault(vaultPool, member);
    const auth = { Authorization: `Bearer ${member.token}` };
    await request(app.getHttpServer())
      .post("/v1/me/delivery-address")
      .set(auth)
      .send({ address: "House 11, Kikkeri Village, Mandya 571401", zoneHint: "Kikkeri" });
    await pool.query(
      `INSERT INTO token_ledger (alias_id, entry, tokens, ref_type, ref_id) VALUES ($1, 'earn_bonus', $2, 'test-seed', $3)`,
      [member.aliasId, tokens, `seed-${member.aliasId}`]
    );
    await pool.query(`UPDATE members SET token_balance = $1 WHERE alias_id = $2`, [
      tokens,
      member.aliasId,
    ]);
    return member;
  }

  async function overview() {
    const res = await request(app.getHttpServer()).get("/v1/admin/token-economy/overview");
    expect(res.status).toBe(200);
    return res.body as {
      totalMembers: number;
      outstandingTokens: number;
      realisedTokens: number;
      reservedPaise: number;
      currentTokenRatePaise: number | null;
      tokenRateComputedAt: string | null;
    };
  }

  it("tracks a member's tokens as outstanding until redemption, then realised only once delivery is confirmed", async () => {
    const before = await overview();

    const member = await memberWithAddressAndTokens(100);
    const afterEarn = await overview();
    expect(afterEarn.totalMembers - before.totalMembers).toBe(1);
    expect(afterEarn.outstandingTokens - before.outstandingTokens).toBe(100);
    expect(afterEarn.realisedTokens - before.realisedTokens).toBe(0);
    expect(afterEarn.reservedPaise - before.reservedPaise).toBe(0);

    const auth = { Authorization: `Bearer ${member.token}` };
    await pool.query(
      `INSERT INTO intents (alias_id, product_category_id, "window", strength, expires_at)
       VALUES ($1, $2, '1m', 'yes', now() + interval '1 month')`,
      [member.aliasId, riceCategoryId]
    );
    await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/join`)
      .set(auth)
      .send({ qty: 1, tokensToRedeem: 40 });

    const afterRedeem = await overview();
    // Spent, so no longer outstanding — but not yet realised either, since
    // delivery hasn't been confirmed (SPEC.md §40's whole point).
    expect(afterRedeem.outstandingTokens - before.outstandingTokens).toBe(60);
    expect(afterRedeem.realisedTokens - before.realisedTokens).toBe(0);
    expect(afterRedeem.reservedPaise - before.reservedPaise).toBe(0);

    await request(app.getHttpServer()).post(`/v1/offers/${riceOfferId}/confirm-delivery`).set(auth);

    const afterDelivery = await overview();
    expect(afterDelivery.outstandingTokens - before.outstandingTokens).toBe(60);
    expect(afterDelivery.realisedTokens - before.realisedTokens).toBe(40);
    expect(afterDelivery.reservedPaise - before.reservedPaise).toBe(40 * TOKEN_VALUE_PAISE);

    await cleanupMember(member);
  });

  it("surfaces the current published token rate, or null if none has run yet", async () => {
    const body = await overview();
    expect(body.currentTokenRatePaise === null || typeof body.currentTokenRatePaise === "number").toBe(
      true
    );
  });
});
