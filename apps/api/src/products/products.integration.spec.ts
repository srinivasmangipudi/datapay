import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { DEFAULT_PURCHASE_REWARD_TOKENS } from "@datapay/shared";
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

  /**
   * Ordering without an address SUCCEEDS. The address lives in the Vault and is
   * managed there; gating a reservation behind retyping it was the old
   * behaviour and it made members re-enter their address on every order.
   * Delivery is sorted out afterwards — a saved address, or PACS collection.
   */
  it("ordering succeeds with no address on file, and flags that delivery needs sorting", async () => {
    const productId = await seedProduct(5);
    const member = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);
    await registerTestMemberInVault(vaultPool, member);

    const res = await request(app.getHttpServer())
      .post(`/v1/products/${productId}/order`)
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ quantity: 1, clientMsgId: randomUUID() });

    expect(res.status).toBe(201);
    expect(res.body.needsDeliveryAddress).toBe(true);

    // Stock IS taken — the reservation is real, only its delivery is pending.
    const { rows } = await pool.query<{ quantity_available: number }>(
      `SELECT quantity_available FROM org_products WHERE id = $1`,
      [productId]
    );
    expect(rows[0].quantity_available).toBe(4);

    // Nothing to resolve yet: Vault has no mapping for this token.
    const early = await request(app.getHttpServer())
      .post("/v1/relay/resolve")
      .send({ relayToken: res.body.relayToken });
    expect(early.status).toBeGreaterThanOrEqual(400);

    // Saving an address backfills the pending relay, so the member does not
    // have to re-order for it to become deliverable.
    await request(app.getHttpServer())
      .post("/v1/me/delivery-address")
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ address: "House 11, Kikkeri Village, Mandya 571401" });

    const resolved = await request(app.getHttpServer())
      .post("/v1/relay/resolve")
      .send({ relayToken: res.body.relayToken });
    expect(resolved.status).toBe(201);
    expect(resolved.body.address).toContain("House 11");

    await cleanupMember(member);
  });

  it("ordering decrements stock, is identity-blind to the org, and resolves via relay", async () => {
    const productId = await seedProduct(5);
    const member = await memberWithAddress();

    const res = await request(app.getHttpServer())
      .post(`/v1/products/${productId}/order`)
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ quantity: 2, clientMsgId: randomUUID() });

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
        .send({ quantity: 1, clientMsgId: randomUUID() });

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

  /**
   * The failure this exists for: rural connectivity drops the RESPONSE, not the
   * request. The server commits, the reply never lands, the member taps again.
   * Without an idempotency key that is a second order and a second decrement of
   * genuinely scarce stock.
   */
  it("retrying an order with the same clientMsgId returns the first order and never decrements twice", async () => {
    const productId = await seedProduct(5);
    const member = await memberWithAddress();
    const clientMsgId = randomUUID();

    const send = () =>
      request(app.getHttpServer())
        .post(`/v1/products/${productId}/order`)
        .set({ Authorization: `Bearer ${member.token}` })
        .send({ quantity: 2, clientMsgId });

    const first = await send();
    expect(first.status).toBe(201);

    const retry = await send();
    expect(retry.status).toBe(201);
    expect(retry.body.orderId).toBe(first.body.orderId);
    expect(retry.body.relayToken).toBe(first.body.relayToken);

    const { rows } = await pool.query<{ quantity_available: number }>(
      `SELECT quantity_available FROM org_products WHERE id = $1`,
      [productId]
    );
    expect(rows[0].quantity_available).toBe(3); // 5 - 2, once

    const { rows: orderRows } = await pool.query(
      `SELECT id FROM product_orders WHERE client_msg_id = $1`,
      [clientMsgId]
    );
    expect(orderRows).toHaveLength(1);

    // The retry must not have left an orphaned relay in Vault either — it
    // returns before registerRelay, so only the first attempt ever registered.
    const { rows: relayRows } = await vaultPool.query(
      `SELECT relay_token FROM relay_map WHERE offer_ref = $1`,
      [`product-order:${first.body.relayToken}`]
    );
    expect(relayRows).toHaveLength(1);

    await cleanupMember(member);
  });

  it("two orders with different clientMsgIds are two real orders", async () => {
    const productId = await seedProduct(5);
    const member = await memberWithAddress();

    const send = () =>
      request(app.getHttpServer())
        .post(`/v1/products/${productId}/order`)
        .set({ Authorization: `Bearer ${member.token}` })
        .send({ quantity: 1, clientMsgId: randomUUID() });

    const first = await send();
    const second = await send();
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.orderId).not.toBe(first.body.orderId);

    const { rows } = await pool.query<{ quantity_available: number }>(
      `SELECT quantity_available FROM org_products WHERE id = $1`,
      [productId]
    );
    expect(rows[0].quantity_available).toBe(3); // decremented twice, correctly

    await cleanupMember(member);
  });

  /**
   * A FLAT count per order, never a share of spend. Quantity is 2 and the
   * price is ₹399 — neither changes the reward, which is the whole point: a
   * proportional reward would make money-in produce tokens-out, and tokens set
   * a share of the reward pool.
   */
  it("crediting: an order earns the product's flat token count, and a retry never credits twice", async () => {
    const productId = await seedProduct(5);
    await pool.query(`UPDATE org_products SET purchase_reward_tokens = 3 WHERE id = $1`, [productId]);
    const member = await memberWithAddress();
    const clientMsgId = randomUUID();

    const send = () =>
      request(app.getHttpServer())
        .post(`/v1/products/${productId}/order`)
        .set({ Authorization: `Bearer ${member.token}` })
        .send({ quantity: 2, clientMsgId });

    const first = await send();
    expect(first.status).toBe(201);
    expect(first.body.tokensEarned).toBe(3); // flat — NOT scaled by qty 2 or by ₹399

    const retry = await send();
    expect(retry.body.tokensEarned).toBe(3); // echoes, doesn't re-credit

    const { rows } = await pool.query<{ n: string; total: string }>(
      `SELECT COUNT(*) n, COALESCE(SUM(tokens), 0) total FROM token_ledger
        WHERE alias_id = $1 AND ref_type = 'product_order'`,
      [member.aliasId]
    );
    expect(rows[0].n).toBe("1");
    expect(Number(rows[0].total)).toBe(3);

    await cleanupMember(member);
  });

  it("falls back to the platform default when a product sets no reward", async () => {
    const productId = await seedProduct(5); // purchase_reward_tokens left NULL
    const member = await memberWithAddress();

    const res = await request(app.getHttpServer())
      .post(`/v1/products/${productId}/order`)
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ quantity: 1, clientMsgId: randomUUID() });

    expect(res.body.tokensEarned).toBe(DEFAULT_PURCHASE_REWARD_TOKENS);

    await cleanupMember(member);
  });

  it("a zero reward is honoured as 'no reward', not treated as unset", async () => {
    const productId = await seedProduct(5);
    await pool.query(`UPDATE org_products SET purchase_reward_tokens = 0 WHERE id = $1`, [productId]);
    const member = await memberWithAddress();

    const res = await request(app.getHttpServer())
      .post(`/v1/products/${productId}/order`)
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ quantity: 1, clientMsgId: randomUUID() });

    expect(res.status).toBe(201);
    expect(res.body.tokensEarned).toBe(0);

    const { rows } = await pool.query<{ n: string }>(
      `SELECT COUNT(*) n FROM token_ledger WHERE alias_id = $1 AND ref_type = 'product_order'`,
      [member.aliasId]
    );
    expect(rows[0].n).toBe("0"); // no zero-token ledger row written

    await cleanupMember(member);
  });

  it("rejects an order with no clientMsgId at all", async () => {
    const productId = await seedProduct(5);
    const member = await memberWithAddress();

    const res = await request(app.getHttpServer())
      .post(`/v1/products/${productId}/order`)
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ quantity: 1 });

    expect(res.status).toBe(400);

    const { rows } = await pool.query<{ quantity_available: number }>(
      `SELECT quantity_available FROM org_products WHERE id = $1`,
      [productId]
    );
    expect(rows[0].quantity_available).toBe(5); // nothing touched

    await cleanupMember(member);
  });

  /**
   * Members used to retype their address on every single order: the app POSTed
   * it each time because there was no way to ask whether one was already on
   * file. That also appended an identical delivery_addresses row per order.
   */
  it("a saved address reads back, and re-saving the same text adds no duplicate row", async () => {
    const member = await memberWithAddress();

    const read = await request(app.getHttpServer())
      .get("/v1/me/delivery-address")
      .set({ Authorization: `Bearer ${member.token}` });
    expect(read.status).toBe(200);
    expect(read.body.address).toContain("Kikkeri");

    const countRows = async () => {
      const { rows } = await vaultPool.query<{ n: string }>(
        `SELECT COUNT(*) n FROM delivery_addresses da
         JOIN alias_map am ON am.user_id = da.user_id WHERE am.alias_id = $1`,
        [member.aliasId]
      );
      return Number(rows[0].n);
    };
    expect(await countRows()).toBe(1);

    // Same text again — what an order used to do every time.
    await request(app.getHttpServer())
      .post("/v1/me/delivery-address")
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ address: "House 7, Kikkeri Village, Mandya 571401" });
    expect(await countRows()).toBe(1);

    // A genuine change DOES append: relay_map rows point at a specific address
    // row, so an old order must still resolve to where it was delivered.
    await request(app.getHttpServer())
      .post("/v1/me/delivery-address")
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ address: "House 9, Kikkeri Village, Mandya 571401" });
    expect(await countRows()).toBe(2);

    const after = await request(app.getHttpServer())
      .get("/v1/me/delivery-address")
      .set({ Authorization: `Bearer ${member.token}` });
    expect(after.body.address).toContain("House 9");

    await cleanupMember(member);
  });

  it("returns null rather than erroring when no address is on file", async () => {
    const member = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);
    await registerTestMemberInVault(vaultPool, member);

    const res = await request(app.getHttpServer())
      .get("/v1/me/delivery-address")
      .set({ Authorization: `Bearer ${member.token}` });

    expect(res.status).toBe(200);
    expect(res.body.address).toBeNull();

    await cleanupMember(member);
  });

  /**
   * The "lazy demand" loop: a member declares a need, nothing exists yet, and
   * later a product in that category shows up carrying the declaration as its
   * reason. Deliberately NOT a group mechanic — no threshold, no count of other
   * households, nothing the member has to help reach.
   */
  describe("matching declared intent to products", () => {
    async function declareIntent(aliasId: string, categoryId: number, months: number) {
      await pool.query(
        `INSERT INTO intents (alias_id, product_category_id, "window", strength, expires_at)
         VALUES ($1, $2, '3m', 'yes', now() + ($3 || ' months')::interval)`,
        [aliasId, categoryId, months]
      );
    }

    async function categoryOf(productId: number): Promise<number> {
      const { rows } = await pool.query<{ category_id: number }>(
        `SELECT category_id FROM org_products WHERE id = $1`,
        [productId]
      );
      return rows[0].category_id;
    }

    async function seedCategorisedProduct(): Promise<number> {
      const id = await seedProduct(5);
      await pool.query(
        `UPDATE org_products SET category_id = (SELECT id FROM categories ORDER BY id LIMIT 1)
          WHERE id = $1`,
        [id]
      );
      return id;
    }

    it("a live declaration surfaces the product and says why", async () => {
      const productId = await seedCategorisedProduct();
      const member = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);
      await declareIntent(member.aliasId, await categoryOf(productId), 3);

      const res = await request(app.getHttpServer())
        .get("/v1/products")
        .set({ Authorization: `Bearer ${member.token}` });

      const match = res.body.find((p: { id: number }) => p.id === productId);
      expect(match.matchedIntent).not.toBeNull();
      expect(match.matchedIntent.window).toBe("3m");

      // Declared-for-you sorts first: a member who told us what they needed
      // shouldn't have to scroll past everything else to find it.
      expect(res.body[0].matchedIntent).not.toBeNull();

      await pool.query(`DELETE FROM intents WHERE alias_id = $1`, [member.aliasId]);
      await deleteTestMember(pool, member.aliasId);
    });

    it("an EXPIRED declaration does not surface anything", async () => {
      const productId = await seedCategorisedProduct();
      const member = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);
      await pool.query(
        `INSERT INTO intents (alias_id, product_category_id, "window", strength, expires_at)
         VALUES ($1, $2, '3m', 'yes', now() - interval '1 day')`,
        [member.aliasId, await categoryOf(productId)]
      );

      const res = await request(app.getHttpServer())
        .get("/v1/products")
        .set({ Authorization: `Bearer ${member.token}` });

      // "You said you wanted this" is wrong once the window they named has
      // passed — it reads as the app not having listened.
      const match = res.body.find((p: { id: number }) => p.id === productId);
      expect(match.matchedIntent).toBeNull();

      await pool.query(`DELETE FROM intents WHERE alias_id = $1`, [member.aliasId]);
      await deleteTestMember(pool, member.aliasId);
    });

    it("another member's declaration never leaks into this one's reasons", async () => {
      const productId = await seedCategorisedProduct();
      const declarer = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);
      const other = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);
      await declareIntent(declarer.aliasId, await categoryOf(productId), 3);

      const res = await request(app.getHttpServer())
        .get("/v1/products")
        .set({ Authorization: `Bearer ${other.token}` });

      const match = res.body.find((p: { id: number }) => p.id === productId);
      expect(match.matchedIntent).toBeNull();

      await pool.query(`DELETE FROM intents WHERE alias_id = $1`, [declarer.aliasId]);
      await deleteTestMember(pool, declarer.aliasId);
      await deleteTestMember(pool, other.aliasId);
    });

    it("duplicate declarations in one category yield one product, not two", async () => {
      const productId = await seedCategorisedProduct();
      const member = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);
      const categoryId = await categoryOf(productId);
      await declareIntent(member.aliasId, categoryId, 3);
      await declareIntent(member.aliasId, categoryId, 6);

      const res = await request(app.getHttpServer())
        .get("/v1/products")
        .set({ Authorization: `Bearer ${member.token}` });

      // A plain join would return the product once per intent row.
      const hits = res.body.filter((p: { id: number }) => p.id === productId);
      expect(hits).toHaveLength(1);

      await pool.query(`DELETE FROM intents WHERE alias_id = $1`, [member.aliasId]);
      await deleteTestMember(pool, member.aliasId);
    });
  });
});
