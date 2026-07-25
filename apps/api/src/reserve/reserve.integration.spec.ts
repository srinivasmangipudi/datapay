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
// offer_token_terms.token_value_paise = 24.
const TOKEN_VALUE_PAISE = 24;

describe("Reserve — tokens realise (are backed by real ₹) only at confirmed delivery, 1:1 (SPEC.md §40)", () => {
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
      .send({ address: "House 9, Kikkeri Village, Mandya 571401", zoneHint: "Kikkeri" });

    if (tokens > 0) {
      await pool.query(
        `INSERT INTO token_ledger (alias_id, entry, tokens, ref_type, ref_id) VALUES ($1, 'earn_bonus', $2, 'test-seed', $3)`,
        [member.aliasId, tokens, `seed-${member.aliasId}`]
      );
      await pool.query(`UPDATE members SET token_balance = $1 WHERE alias_id = $2`, [
        tokens,
        member.aliasId,
      ]);
    }
    return member;
  }

  async function reserveTotal(): Promise<number> {
    const { rows } = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM reserve_ledger`
    );
    return Number(rows[0].total);
  }

  it("reserves nothing at redemption — only once delivery is confirmed", async () => {
    const member = await memberWithAddressAndTokens(100);
    const auth = { Authorization: `Bearer ${member.token}` };
    await pool.query(
      `INSERT INTO intents (alias_id, product_category_id, "window", strength, expires_at)
       VALUES ($1, $2, '1m', 'yes', now() + interval '1 month')`,
      [member.aliasId, riceCategoryId]
    );

    const before = await reserveTotal();

    const joinRes = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/join`)
      .set(auth)
      .send({ qty: 1, tokensToRedeem: 40 });
    expect(joinRes.status).toBe(201);

    // Tokens are spent (redeemed) but the offer isn't delivered yet — no
    // reserve should exist for it until confirm-delivery says otherwise.
    expect(await reserveTotal()).toBe(before);

    const confirmRes = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/confirm-delivery`)
      .set(auth);
    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.reservedPaise).toBe(40 * TOKEN_VALUE_PAISE);
    expect(await reserveTotal()).toBe(before + 40 * TOKEN_VALUE_PAISE);

    // idempotent: confirming again doesn't reserve a second time
    const replay = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/confirm-delivery`)
      .set(auth);
    expect(replay.body.status).toBe("already_confirmed");
    expect(await reserveTotal()).toBe(before + 40 * TOKEN_VALUE_PAISE);

    await cleanupMember(member);
  });

  it("reserves nothing when no tokens were redeemed on the offer", async () => {
    const member = await memberWithAddressAndTokens(0);
    const auth = { Authorization: `Bearer ${member.token}` };

    const before = await reserveTotal();
    await request(app.getHttpServer()).post(`/v1/offers/${riceOfferId}/join`).set(auth).send({ qty: 1 });
    const confirmRes = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/confirm-delivery`)
      .set(auth);
    expect(confirmRes.body.reservedPaise).toBe(0);
    expect(await reserveTotal()).toBe(before);

    await cleanupMember(member);
  });

  it("§15B: rejects UPDATE/DELETE on reserve_ledger at the database level, even for real rupees", async () => {
    await pool.query(
      `INSERT INTO reserve_ledger (entry, amount_paise, ref_type, ref_id) VALUES ('accrual', 500, 'test-immutability', $1)`,
      [`imm-${Date.now()}`]
    );
    await expect(
      pool.query(`UPDATE reserve_ledger SET amount_paise = 999999 WHERE ref_type = 'test-immutability'`)
    ).rejects.toThrow(/append-only/);
    await expect(
      pool.query(`DELETE FROM reserve_ledger WHERE ref_type = 'test-immutability'`)
    ).rejects.toThrow(/append-only/);
  });
});
