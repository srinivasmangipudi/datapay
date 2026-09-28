// Runs pending migrations against the Railway databases.
//
// Deliberately does NOT load infra/.env: that file defines CORE_DATABASE_URL
// and VAULT_DATABASE_URL pointing at localhost, and dotenv does not overwrite
// vars that already exist — so a stray load order could silently migrate the
// local database while appearing to migrate production. The URL here is built
// only from Railway's injected DATABASE_PUBLIC_URL.
//
// Run as: railway run --service core-db -- node infra/migrate-prod.mjs <vault|core>
//
// CAUTION: this connects as the SUPERUSER, so any table a migration CREATES is
// owned by `postgres`, not by the app role (`vault_app` / `core_app`) the
// running service connects as — which cannot then read or write it. Locally,
// migrations run as the app role and own everything, so the defect is
// invisible until production. A migration that creates a table must GRANT it
// to the app role explicitly. See
// vault/1759622400000_grant_new_tables_to_vault_app.js for what this cost.
import runner from "node-pg-migrate";

const target = process.argv[2];
if (!["vault", "core"].includes(target)) {
  throw new Error("Usage: node migrate-prod.mjs <vault|core>");
}

const base = process.env.DATABASE_PUBLIC_URL;
if (!base) throw new Error("Missing DATABASE_PUBLIC_URL (run under `railway run`)");

// The default `railway` database is NOT the application database.
const dbName = target === "vault" ? "vault_db" : "core_db";
const databaseUrl = base.replace(/\/railway(\?|$)/, `/${dbName}$1`);
if (!databaseUrl.includes(`/${dbName}`)) {
  throw new Error(`Refusing to run: could not rewrite the database name to ${dbName}`);
}

await runner({
  databaseUrl,
  dir: new URL(`migrations/${target}/`, import.meta.url).pathname,
  direction: "up",
  migrationsTable: "pgmigrations",
  count: Infinity,
  log: (msg) => console.log(`[${target}] ${msg}`),
});
