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

describe("GET /v1/tokens — every token is equal, no issued/realised split (TOKEN_ECONOMY_REDESIGN.md)", () => {
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

  it("balance drops at redemption, then grows again at delivery — buying earns tokens same as answering", async () => {
    const member = await createTestMember(pool, jwt);
    await registerTestMemberInVault(vaultPool, member);
    const auth = { Authorization: `Bearer ${member.token}` };

    await request(app.getHttpServer())
      .post("/v1/me/delivery-address")
      .set(auth)
      .send({ address: "House 13, Kikkeri Village, Mandya 571401", zoneHint: "Kikkeri" });
    await pool.query(
      `INSERT INTO token_ledger (alias_id, entry, tokens, ref_type, ref_id) VALUES ($1, 'earn_bonus', 100, 'test-seed', $2)`,
      [member.aliasId, `seed-${member.aliasId}`]
    );
    await pool.query(`UPDATE members SET token_balance = 100 WHERE alias_id = $1`, [member.aliasId]);
    await pool.query(
      `INSERT INTO intents (alias_id, product_category_id, "window", strength, expires_at)
       VALUES ($1, $2, '1m', 'yes', now() + interval '1 month')`,
      [member.aliasId, riceCategoryId]
    );

    const before = await request(app.getHttpServer()).get("/v1/tokens").set(auth);
    expect(before.body.balance).toBe(100);
    expect(before.body.realisedTokens).toBeUndefined(); // no such field anymore

    await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/join`)
      .set(auth)
      .send({ qty: 1, tokensToRedeem: 40 });

    const afterRedeem = await request(app.getHttpServer()).get("/v1/tokens").set(auth);
    expect(afterRedeem.body.balance).toBe(60);

    const confirmRes = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/confirm-delivery`)
      .set(auth);
    expect(confirmRes.body.purchaseTokens).toBe(EXPECTED_PURCHASE_TOKENS);

    const afterDelivery = await request(app.getHttpServer()).get("/v1/tokens").set(auth);
    // The purchase itself earned new tokens — not "unlocking" the 40 already
    // spent, an ordinary new earn, same balance either way it happened.
    expect(afterDelivery.body.balance).toBe(60 + EXPECTED_PURCHASE_TOKENS);

    const purchaseEntry = afterDelivery.body.history.find(
      (h: { entry: string }) => h.entry === "earn_purchase"
    );
    expect(purchaseEntry).toBeTruthy();
    expect(purchaseEntry.tokens).toBe(EXPECTED_PURCHASE_TOKENS);
    expect(purchaseEntry.label).toContain("Purchase reward");

    await cleanupMember(member);
  });
});
