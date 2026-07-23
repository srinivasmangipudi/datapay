import { Pool } from "pg";

// §10 boundary: this connects with the restricted core_portal role — SELECT
// only on demand_aggregates/token_rate/zones/categories. There is no code
// path to responses/snaps/members/token_ledger because the database itself
// has no grant for this role to reach them, not because this file is careful.
let pool: Pool | null = null;

export function getPortalPool(): Pool {
  if (!pool) {
    const connectionString = process.env.CORE_PORTAL_DATABASE_URL;
    if (!connectionString) throw new Error("Missing CORE_PORTAL_DATABASE_URL");
    pool = new Pool({ connectionString });
  }
  return pool;
}
