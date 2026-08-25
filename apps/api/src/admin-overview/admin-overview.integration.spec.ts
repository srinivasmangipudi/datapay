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

// Seeded rice offer (infra/migrations/core/1737849602000_seed_offer.js):
// collective_price_paise = 119000. 2% of that, as whole rupees: round(119000*0.02/100) = 24.
const EXPECTED_PURCHASE_TOKENS = Math.round((119000 * 0.02) / 100);
const EXPECTED_CORPUS_CONTRIBUTION_PAISE = Math.round(119000 * 0.02);

// Real pilot data (and other suites' members) may already exist, so every
// assertion here is a DELTA across a live earn→redeem→deliver cycle, never
// an absolute count — same lesson as isEligibleForPulseToday/the fund test's
// before/after balance check.
describe("Admin overview — the 'main company page' numbers (TOKEN_ECONOMY_REDESIGN.md)", () => {
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
      totalTokens: number;
      corpusFundPaise: number;
    };
  }

  it("every token counts the same — no issued/realised split — and buying adds to both the member's tokens and the corpus", async () => {
    const before = await overview();

    const member = await memberWithAddressAndTokens(100);
    const afterEarn = await overview();
    expect(afterEarn.totalMembers - before.totalMembers).toBe(1);
    expect(afterEarn.totalTokens - before.totalTokens).toBe(100);
    expect(afterEarn.corpusFundPaise - before.corpusFundPaise).toBe(0);

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
    // Redeeming spends 40 of the member's own tokens — total supply drops by
    // that much, nothing waiting in an intermediate "issued" state anymore.
    expect(afterRedeem.totalTokens - before.totalTokens).toBe(60);
    expect(afterRedeem.corpusFundPaise - before.corpusFundPaise).toBe(0);

    await request(app.getHttpServer()).post(`/v1/offers/${riceOfferId}/confirm-delivery`).set(auth);

    const afterDelivery = await overview();
    // The purchase earns the member NEW tokens (2% of spend) — an ordinary
    // credit, same ledger as answering a question — and the supplier's 2%
    // lands in the corpus fund, both at the same confirm-delivery event.
    expect(afterDelivery.totalTokens - before.totalTokens).toBe(60 + EXPECTED_PURCHASE_TOKENS);
    expect(afterDelivery.corpusFundPaise - before.corpusFundPaise).toBe(
      EXPECTED_CORPUS_CONTRIBUTION_PAISE
    );

    await cleanupMember(member);
  });
});
