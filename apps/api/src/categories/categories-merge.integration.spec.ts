import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { CategoriesService } from "./categories.service";

describe("Category merge", () => {
  let app: INestApplication;
  let pool: Pool;
  let categories: CategoriesService;
  const madeCategorySlugs: string[] = [];
  const madeAliases: string[] = [];

  /** consents.alias_id is FK'd to members, so a consent fixture needs one. */
  async function makeMember(): Promise<string> {
    const alias = randomUUID().replace(/-/g, "").padEnd(64, "0").slice(0, 64);
    await pool.query(
      `INSERT INTO members (alias_id, display_alias, zone_id)
       VALUES ($1, $2, '00000000-0000-0000-0000-000000000005')`,
      [alias, `Merge Test ${alias.slice(0, 8)}`]
    );
    madeAliases.push(alias);
    return alias;
  }

  async function makeCategory(name: string): Promise<number> {
    const { id } = await categories.create({ name, sensitivity: "standard" });
    const { rows } = await pool.query<{ slug: string }>("SELECT slug FROM categories WHERE id = $1", [id]);
    madeCategorySlugs.push(rows[0].slug);
    return id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    categories = app.get(CategoriesService);
  });

  afterAll(async () => {
    if (madeAliases.length) {
      await pool.query("DELETE FROM consents WHERE alias_id = ANY($1)", [madeAliases]);
      await pool.query("DELETE FROM consent_events WHERE alias_id = ANY($1)", [madeAliases]);
      await pool.query("DELETE FROM members WHERE alias_id = ANY($1)", [madeAliases]);
    }
    if (madeCategorySlugs.length) {
      await pool.query("DELETE FROM categories WHERE slug = ANY($1)", [madeCategorySlugs]);
    }
    await app.close();
    await pool.end();
  });

  /**
   * The merge repoints an explicit list of columns. If someone adds a new FK
   * to categories and doesn't decide what merging means for it, the merge
   * would fail at runtime on a RESTRICT delete — this fails at test time
   * instead, naming the column that was missed.
   */
  it("covers every foreign key that references categories", async () => {
    const { rows } = await pool.query<{ table_name: string; column_name: string }>(`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'categories'`);

    const live = rows.map((r) => `${r.table_name}.${r.column_name}`).sort();

    // Everything the merge handles: the repointed list, plus consents, which
    // is handled separately because of its UNIQUE (alias_id, category_id).
    const handled = [
      "consent_events.category_id",
      "consents.category_id",
      "demand_aggregates.category_id",
      "intents.product_category_id",
      "org_products.category_id",
      "products.category_id",
      "question_topics.category_id",
      "questions.category_id",
      "responses.recognized_category_id",
      "snaps.category_id",
      "snaps.recognized_category_id",
    ].sort();

    expect(live).toEqual(handled);
  });

  it("moves rows off the source, then deletes it", async () => {
    const source = await makeCategory(`Merge Source ${randomUUID().slice(0, 8)}`);
    const target = await makeCategory(`Merge Target ${randomUUID().slice(0, 8)}`);

    await pool.query(
      `INSERT INTO questions (category_id, type, text_en, reward_tokens) VALUES ($1, 'yesno', $2, 1)`,
      [source, `merge-test-${randomUUID()}`]
    );

    const before = await categories.usage(source);
    expect(before.total).toBe(1);

    const result = await categories.merge(source, target);
    expect(result.into.id).toBe(target);
    expect(result.moved).toEqual(
      expect.arrayContaining([{ table: "questions", column: "category_id", count: 1 }])
    );

    const gone = await pool.query("SELECT id FROM categories WHERE id = $1", [source]);
    expect(gone.rows).toHaveLength(0);

    const moved = await pool.query("SELECT id FROM questions WHERE category_id = $1", [target]);
    expect(moved.rows.length).toBeGreaterThan(0);

    await pool.query("DELETE FROM questions WHERE category_id = $1", [target]);
  });

  it("refuses to merge a category into itself", async () => {
    const id = await makeCategory(`Merge Self ${randomUUID().slice(0, 8)}`);
    await expect(categories.merge(id, id)).rejects.toThrow(/itself/i);
  });

  it("never widens consent: denied on either side stays denied after the merge", async () => {
    const source = await makeCategory(`Consent Source ${randomUUID().slice(0, 8)}`);
    const target = await makeCategory(`Consent Target ${randomUUID().slice(0, 8)}`);
    const alias = await makeMember();

    // Member denied the category being merged away, but allowed the survivor.
    await pool.query(`INSERT INTO consents (alias_id, category_id, granted) VALUES ($1, $2, false)`, [alias, source]);
    await pool.query(`INSERT INTO consents (alias_id, category_id, granted) VALUES ($1, $2, true)`, [alias, target]);

    const result = await categories.merge(source, target);
    expect(result.consentsCollapsed).toBe(1);
    expect(result.consentsNarrowedToDenied).toBe(1);

    const { rows } = await pool.query<{ granted: boolean }>(
      `SELECT granted FROM consents WHERE alias_id = $1 AND category_id = $2`, [alias, target]);
    expect(rows).toHaveLength(1);
    expect(rows[0].granted).toBe(false); // narrowed, not widened

    await pool.query("DELETE FROM consents WHERE alias_id = $1", [alias]);
  });

  it("moves a consent that has no counterpart on the target", async () => {
    const source = await makeCategory(`Consent Move Src ${randomUUID().slice(0, 8)}`);
    const target = await makeCategory(`Consent Move Tgt ${randomUUID().slice(0, 8)}`);
    const alias = await makeMember();

    await pool.query(`INSERT INTO consents (alias_id, category_id, granted) VALUES ($1, $2, true)`, [alias, source]);

    const result = await categories.merge(source, target);
    expect(result.consentsCollapsed).toBe(0);

    const { rows } = await pool.query<{ granted: boolean }>(
      `SELECT granted FROM consents WHERE alias_id = $1 AND category_id = $2`, [alias, target]);
    expect(rows).toHaveLength(1);
    expect(rows[0].granted).toBe(true);

    await pool.query("DELETE FROM consents WHERE alias_id = $1", [alias]);
  });
});
