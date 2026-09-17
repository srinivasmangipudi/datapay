import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { LlmProvider } from "../intelligence/llm.provider";
import { StorageProvider } from "../snaps/storage.provider";
import { OrgProductsService } from "./org-products.service";

class FakeLlmProvider implements LlmProvider {
  constructor(private readonly response: string) {}
  async complete(): Promise<string> {
    return this.response;
  }
}

class FakeStorageProvider implements StorageProvider {
  async store(imageBase64: string): Promise<{ storageKey: string }> {
    return { storageKey: `fake://${imageBase64.length}` };
  }
}

const SHEET_V1 = JSON.stringify([
  { nameEn: "Basmati Rice", unitSpec: "5kg", marketPricePaise: 45000, salePricePaise: 39900, quantityAvailable: 25 },
  { nameEn: "Toor Dal", unitSpec: "1kg", marketPricePaise: 14000, salePricePaise: 12500, quantityAvailable: 40 },
]);

// Same product names, Basmati Rice's price/stock changed, one genuinely new item.
const SHEET_V2 = JSON.stringify([
  { nameEn: "Basmati Rice", unitSpec: "5kg", marketPricePaise: 45000, salePricePaise: 35000, quantityAvailable: 10 },
  { nameEn: "Toor Dal", unitSpec: "1kg", marketPricePaise: 14000, salePricePaise: 12500, quantityAvailable: 40 },
  { nameEn: "Toothpaste", unitSpec: "200g", marketPricePaise: 9000, salePricePaise: 7900, quantityAvailable: 60 },
]);

describe("Org product catalog — sheet import dedup/upsert + review gating", () => {
  let app: INestApplication;
  let pool: Pool;
  let orgProducts: OrgProductsService;
  let organizationId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    orgProducts = app.get(OrgProductsService);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  beforeEach(async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO organizations (slug, name, email, password_hash) VALUES ($1, 'Test Org', $2, 'x') RETURNING id`,
      [`test-org-${randomUUID()}`, `${randomUUID()}@example.com`]
    );
    organizationId = rows[0].id;
    orgProducts.storageOverride = new FakeStorageProvider();
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM product_orders WHERE org_product_id IN (SELECT id FROM org_products WHERE organization_id = $1)`, [organizationId]);
    await pool.query(`DELETE FROM org_product_import_runs WHERE organization_id = $1`, [organizationId]);
    await pool.query(`DELETE FROM org_products WHERE organization_id = $1`, [organizationId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    orgProducts.llmOverride = null;
    orgProducts.sheetFetchOverride = null;
    orgProducts.storageOverride = null;
  });

  it("extracts and creates products as drafts on first import", async () => {
    orgProducts.llmOverride = new FakeLlmProvider(SHEET_V1);
    orgProducts.sheetFetchOverride = async () => "fake csv text";

    await orgProducts.importFromSheet(organizationId, "http://example.com/sheet.csv");

    const products = await orgProducts.listOwnProducts(organizationId);
    expect(products).toHaveLength(2);
    expect(products.every((p) => p.review_state === "draft")).toBe(true);
    expect(products.every((p) => p.source === "sheet_extracted")).toBe(true);

    const [run] = await orgProducts.listImportRuns(organizationId);
    expect(run.status).toBe("completed");
    expect(run.products_found).toBe(2);
    expect(run.products_created).toBe(2);
    expect(run.products_updated).toBe(0);
  });

  it("re-import upserts by name: updates an already-approved product in place (no re-review, no duplicate), and a new item lands as a fresh draft", async () => {
    orgProducts.llmOverride = new FakeLlmProvider(SHEET_V1);
    orgProducts.sheetFetchOverride = async () => "fake csv text";
    await orgProducts.importFromSheet(organizationId, "http://example.com/sheet.csv");

    const [rice] = await pool.query<{ id: number }>(
      `SELECT id FROM org_products WHERE organization_id = $1 AND name_en = 'Basmati Rice'`,
      [organizationId]
    ).then((r) => r.rows);
    await orgProducts.review(rice.id, "approved");

    orgProducts.llmOverride = new FakeLlmProvider(SHEET_V2);
    await orgProducts.importFromSheet(organizationId, "http://example.com/sheet.csv");

    const products = await orgProducts.listOwnProducts(organizationId);
    expect(products).toHaveLength(3); // still 2 known + 1 new — never 4 or 5

    const riceAfter = products.find((p) => p.name_en === "Basmati Rice")!;
    expect(riceAfter.id).toBe(rice.id); // same row, not a duplicate
    expect(riceAfter.review_state).toBe("approved"); // untouched by the re-import
    expect(riceAfter.sale_price_paise).toBe(35000); // but its price DID sync
    expect(riceAfter.quantity_available).toBe(10);

    const toothpaste = products.find((p) => p.name_en === "Toothpaste")!;
    expect(toothpaste.review_state).toBe("draft"); // genuinely new — needs review

    const runs = await orgProducts.listImportRuns(organizationId); // DESC — index 0 is the second run
    expect(runs[0].products_created).toBe(1);
    expect(runs[0].products_updated).toBe(2);
  });

  it("review() only ever transitions a draft — approving twice is a no-op error, not a double-approval", async () => {
    orgProducts.llmOverride = new FakeLlmProvider(SHEET_V1);
    orgProducts.sheetFetchOverride = async () => "fake csv text";
    await orgProducts.importFromSheet(organizationId, "http://example.com/sheet.csv");
    const [product] = await orgProducts.listOwnProducts(organizationId);

    await orgProducts.review(product.id, "approved");
    await expect(orgProducts.review(product.id, "approved")).rejects.toThrow(/not found/i);
  });

  it("org-facing order listing never selects alias_id, even at the SQL level", async () => {
    orgProducts.llmOverride = new FakeLlmProvider(SHEET_V1);
    orgProducts.sheetFetchOverride = async () => "fake csv text";
    await orgProducts.importFromSheet(organizationId, "http://example.com/sheet.csv");
    const [product] = await orgProducts.listOwnProducts(organizationId);
    await orgProducts.review(product.id, "approved");

    await pool.query(
      `INSERT INTO members (alias_id, display_alias, zone_id)
       VALUES ($1, 'Order Test Member', '00000000-0000-0000-0000-000000000005')
       ON CONFLICT DO NOTHING`,
      ["a".repeat(64)]
    );
    await pool.query(
      `INSERT INTO product_orders (org_product_id, alias_id, relay_token, quantity, unit_price_paise)
       VALUES ($1, $2, $3, 1, $4)`,
      [product.id, "a".repeat(64), randomUUID(), product.sale_price_paise]
    );

    const orders = await orgProducts.listOwnOrders(organizationId);
    expect(orders).toHaveLength(1);
    expect(orders[0]).not.toHaveProperty("alias_id");
    expect(orders[0].relay_token).toBeDefined();

    await pool.query(`DELETE FROM members WHERE alias_id = $1`, ["a".repeat(64)]);
  });

  it("a bad LLM response fails the whole run loudly and leaves no partial products", async () => {
    orgProducts.llmOverride = new FakeLlmProvider("not valid json");
    orgProducts.sheetFetchOverride = async () => "fake csv text";

    await expect(orgProducts.importFromSheet(organizationId, "http://example.com/sheet.csv")).rejects.toThrow();

    const products = await orgProducts.listOwnProducts(organizationId);
    expect(products).toHaveLength(0);
    const [run] = await orgProducts.listImportRuns(organizationId);
    expect(run.status).toBe("failed");
    expect(run.error_message).toBeTruthy();
  });
});
