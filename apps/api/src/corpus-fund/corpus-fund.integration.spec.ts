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
// collective_price_paise = 119000.
const EXPECTED_CORPUS_CONTRIBUTION_PAISE = Math.round(119000 * 0.02);

describe("Corpus fund — supplier's 2% only lands at confirmed delivery, never spent down (TOKEN_ECONOMY_REDESIGN.md)", () => {
  let app: INestApplication;
  let pool: Pool;
  let vaultPool: Pool;
  let jwt: JwtService;
  let riceOfferId: number;

  beforeAll(async () => {
    await startVaultForTest();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
    vaultPool = new Pool({ connectionString: process.env.VAULT_DATABASE_URL });

    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM offers WHERE product_code = 'rice-sona-masuri-25kg'`
    );
    riceOfferId = rows[0].id;
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

  async function memberWithAddress(): Promise<TestMember> {
    const member = await createTestMember(pool, jwt);
    await registerTestMemberInVault(vaultPool, member);
    await request(app.getHttpServer())
      .post("/v1/me/delivery-address")
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ address: "House 15, Kikkeri Village, Mandya 571401", zoneHint: "Kikkeri" });
    return member;
  }

  async function corpusTotal(): Promise<number> {
    const { rows } = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM corpus_fund_ledger`
    );
    return Number(rows[0].total);
  }

  it("credits 2% of the sale to the corpus only at confirmed delivery, and never twice", async () => {
    const member = await memberWithAddress();
    const auth = { Authorization: `Bearer ${member.token}` };

    const before = await corpusTotal();

    const joinRes = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/join`)
      .set(auth)
      .send({ qty: 1 });
    expect(joinRes.status).toBe(201);

    // Joining alone contributes nothing — no sale is verified yet.
    expect(await corpusTotal()).toBe(before);

    const confirmRes = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/confirm-delivery`)
      .set(auth);
    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.corpusContributionPaise).toBe(EXPECTED_CORPUS_CONTRIBUTION_PAISE);
    expect(await corpusTotal()).toBe(before + EXPECTED_CORPUS_CONTRIBUTION_PAISE);

    // idempotent: confirming again doesn't contribute a second time
    const replay = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/confirm-delivery`)
      .set(auth);
    expect(replay.body.status).toBe("already_confirmed");
    expect(await corpusTotal()).toBe(before + EXPECTED_CORPUS_CONTRIBUTION_PAISE);

    await cleanupMember(member);
  });

  it("§15B: rejects UPDATE/DELETE on corpus_fund_ledger at the database level, even for real rupees", async () => {
    await pool.query(
      `INSERT INTO corpus_fund_ledger (entry, amount_paise, ref_type, ref_id) VALUES ('contribution', 500, 'test-immutability', $1)`,
      [`imm-${Date.now()}`]
    );
    await expect(
      pool.query(`UPDATE corpus_fund_ledger SET amount_paise = 999999 WHERE ref_type = 'test-immutability'`)
    ).rejects.toThrow(/append-only/);
    await expect(
      pool.query(`DELETE FROM corpus_fund_ledger WHERE ref_type = 'test-immutability'`)
    ).rejects.toThrow(/append-only/);
  });
});
