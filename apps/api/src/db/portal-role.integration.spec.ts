import { Pool } from "pg";

// SPEC.md §10 — the portal reads ONLY demand_aggregates (+ zones/categories
// for display labels). Enforced as a separate Postgres role, not by which
// queries the portal's own code happens to write.
describe("core_portal DB role — reads aggregates only (SPEC.md §10)", () => {
  let portalPool: Pool;

  beforeAll(() => {
    portalPool = new Pool({ connectionString: process.env.CORE_PORTAL_DATABASE_URL });
  });

  afterAll(async () => {
    await portalPool.end();
  });

  it.each(["demand_aggregates", "token_rate", "zones", "categories"])(
    "can SELECT %s",
    async (table) => {
      await expect(portalPool.query(`SELECT * FROM ${table} LIMIT 1`)).resolves.toBeDefined();
    }
  );

  it.each([
    "members",
    "responses",
    "snaps",
    "consents",
    "consent_events",
    "token_ledger",
    "questions",
    "question_options",
    "question_topics",
    "question_generation_runs",
  ])("CANNOT SELECT %s", async (table) => {
    await expect(portalPool.query(`SELECT * FROM ${table} LIMIT 1`)).rejects.toThrow(
      /permission denied/
    );
  });
});
