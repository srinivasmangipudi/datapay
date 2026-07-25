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

describe("GET /v1/tokens — balance is outstanding, realisedTokens only counts delivered redemptions (SPEC.md §40)", () => {
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

  it("balance drops at redemption; realisedTokens stays 0 until delivery is confirmed", async () => {
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
    expect(before.body.realisedTokens).toBe(0);

    await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/join`)
      .set(auth)
      .send({ qty: 1, tokensToRedeem: 40 });

    const afterRedeem = await request(app.getHttpServer()).get("/v1/tokens").set(auth);
    expect(afterRedeem.body.balance).toBe(60);
    expect(afterRedeem.body.realisedTokens).toBe(0); // spent, but not yet delivered

    await request(app.getHttpServer()).post(`/v1/offers/${riceOfferId}/confirm-delivery`).set(auth);

    const afterDelivery = await request(app.getHttpServer()).get("/v1/tokens").set(auth);
    expect(afterDelivery.body.balance).toBe(60); // unchanged — confirm-delivery doesn't touch balance
    expect(afterDelivery.body.realisedTokens).toBe(40);

    await cleanupMember(member);
  });
});
