import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

const CORE_MIGRATIONS_DIR = join(__dirname, "../../../../infra/migrations/core");
const PHONE_LIKE = /phone/i;
// Matches an actual column-key declaration (e.g. `phone_e164:` or `"phoneNumber":`),
// not the word appearing in a comment or string literal describing the guarantee.
const PHONE_COLUMN_DECLARATION = /["']?\bphone[a-z0-9_]*["']?\s*:/i;
const E164_PATTERN = /^\+?[1-9]\d{6,14}$/;

describe("LAW 1 — phone is provably absent from core_db", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: process.env.CORE_DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("has no column named anything like 'phone' in any core_db table (schema check)", async () => {
    const { rows } = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public'`
    );
    const offenders = rows.filter((r) => PHONE_LIKE.test(r.column_name));
    expect(offenders).toEqual([]);
  });

  it("has no migration file that declares a phone column (grep check)", () => {
    const files = readdirSync(CORE_MIGRATIONS_DIR).filter((f) => f.endsWith(".js"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const text = readFileSync(join(CORE_MIGRATIONS_DIR, file), "utf8");
      expect(text).not.toMatch(PHONE_COLUMN_DECLARATION);
    }
  });

  it("has no sample row, in any text column of any table, shaped like an E.164 phone number", async () => {
    const { rows: tables } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    expect(tables.length).toBeGreaterThan(0);

    for (const { table_name } of tables) {
      const { rows: columns } = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
           AND data_type IN ('text', 'character varying')`,
        [table_name]
      );
      for (const { column_name } of columns) {
        const { rows: values } = await pool.query<{ v: string }>(
          `SELECT "${column_name}" AS v FROM "${table_name}" WHERE "${column_name}" IS NOT NULL`
        );
        for (const { v } of values) {
          expect(E164_PATTERN.test(v)).toBe(false);
        }
      }
    }
  });
});
