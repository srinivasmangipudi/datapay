import "dotenv/config";
import runner from "node-pg-migrate";

const [, , target, direction = "up"] = process.argv;

if (!["vault", "core"].includes(target)) {
  throw new Error(`Usage: node migrate.mjs <vault|core> <up|down>`);
}

const databaseUrl =
  target === "vault" ? process.env.VAULT_DATABASE_URL : process.env.CORE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(`Missing ${target.toUpperCase()}_DATABASE_URL (see .env.example)`);
}

await runner({
  databaseUrl,
  dir: `migrations/${target}`,
  direction,
  migrationsTable: "pgmigrations",
  count: direction === "down" ? 1 : Infinity,
  log: (msg) => console.log(`[${target}] ${msg}`),
});
