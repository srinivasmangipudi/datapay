import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
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

const CORE_MIGRATIONS_DIR = join(__dirname, "../../../../infra/migrations/core");
const ADDRESS_COLUMN_DECLARATION = /["']?\baddress[a-z0-9_]*["']?\s*:/i;

describe("Offers + redemption gate (SPEC.md §6 LAW 2 / §15D / §7)", () => {
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

    const addrRes = await request(app.getHttpServer())
      .post("/v1/me/delivery-address")
      .set(auth)
      .send({ address: "House 7, Kikkeri Village, Mandya 571401", zoneHint: "Kikkeri" });
    expect(addrRes.status).toBe(201);

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

  it("§6 LAW 2: rejects redemption when no matching declared intent exists", async () => {
    const member = await memberWithAddressAndTokens(100);
    const auth = { Authorization: `Bearer ${member.token}` };

    const res = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/join`)
      .set(auth)
      .send({ qty: 1, tokensToRedeem: 50 });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/no matching declared intent/i);

    const { rows: balance } = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    expect(balance[0].token_balance).toBe(100); // untouched — the gate rejected before any debit

    await cleanupMember(member);
  });

  it("§6/§15A: redeems once a matching intent exists — balanced ledger entry, intent marked fulfilled", async () => {
    const member = await memberWithAddressAndTokens(100);
    const auth = { Authorization: `Bearer ${member.token}` };

    const { rows: intentRows } = await pool.query<{ id: number }>(
      `INSERT INTO intents (alias_id, product_category_id, "window", strength, expires_at)
       VALUES ($1, $2, '1m', 'yes', now() + interval '1 month') RETURNING id`,
      [member.aliasId, riceCategoryId]
    );

    const res = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/join`)
      .set(auth)
      .send({ qty: 1, tokensToRedeem: 40 });

    expect(res.status).toBe(201);
    expect(res.body.tokensRedeemed).toBe(40);
    expect(res.body.relayToken).toMatch(/^[0-9a-f-]{36}$/);

    const { rows: balance } = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    expect(balance[0].token_balance).toBe(60);

    const { rows: ledgerRows } = await pool.query(
      `SELECT tokens FROM token_ledger WHERE ref_type = 'offer_participation' AND alias_id = $1`,
      [member.aliasId]
    );
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0].tokens).toBe(-40);

    const { rows: intentAfter } = await pool.query<{ fulfilled_offer_id: number }>(
      `SELECT fulfilled_offer_id FROM intents WHERE id = $1`,
      [intentRows[0].id]
    );
    expect(intentAfter[0].fulfilled_offer_id).toBe(riceOfferId);

    await cleanupMember(member);
  });

  it("§7: relay resolves the real address via Vault, but core_db never stores one", async () => {
    const member = await memberWithAddressAndTokens(0);
    const auth = { Authorization: `Bearer ${member.token}` };

    const joinRes = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/join`)
      .set(auth)
      .send({ qty: 1 });
    expect(joinRes.status).toBe(201);
    const relayToken = joinRes.body.relayToken;

    // core_db side: no migration ever declares an address-storing column —
    // the only thing offer_participation carries is the opaque relay_token.
    const files = readdirSync(CORE_MIGRATIONS_DIR).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      const text = readFileSync(join(CORE_MIGRATIONS_DIR, file), "utf8");
      expect(text).not.toMatch(ADDRESS_COLUMN_DECLARATION);
    }

    // The node's side: resolving the SAME relay_token through the proxy
    // returns the real address — identity crosses the seal only here.
    const resolveRes = await request(app.getHttpServer())
      .post("/v1/relay/resolve")
      .send({ relayToken });
    expect(resolveRes.status).toBe(201);
    expect(resolveRes.body.address).toContain("Kikkeri");

    await cleanupMember(member);
  });

  it("§15D: concurrent join/redeem for the same member serializes — exactly one succeeds", async () => {
    const member = await memberWithAddressAndTokens(100);
    const auth = { Authorization: `Bearer ${member.token}` };

    await pool.query(
      `INSERT INTO intents (alias_id, product_category_id, "window", strength, expires_at)
       VALUES ($1, $2, '1m', 'yes', now() + interval '1 month')`,
      [member.aliasId, riceCategoryId]
    );

    const attempt = () =>
      request(app.getHttpServer())
        .post(`/v1/offers/${riceOfferId}/join`)
        .set(auth)
        .send({ qty: 1, tokensToRedeem: 30 });

    const [first, second] = await Promise.all([attempt(), attempt()]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 400]);

    const { rows: balance } = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    expect(balance[0].token_balance).toBe(70); // debited exactly once, never twice

    await cleanupMember(member);
  });
});
