import { defineRailway, github, postgres, preserve, project, redis, service } from "railway/iac";

export default defineRailway(() => {
  const REPO = "srinivasmangipudi/datapay";

  // Railway's plan caps this project at 5 services (and 3 volumes), so one
  // Postgres SERVER hosts two separate DATABASES (core_db, vault_db)
  // instead of two instances — LAW 1's actual guarantee (separate roles,
  // separate databases, no cross-database queries — Postgres doesn't
  // support that without extensions) still holds; this is shared hosting,
  // not shared data. Reuses the "core-db" resource already provisioned
  // (not a new Postgres — the account is already at its 3-volume cap).
  // `db.env.DATABASE_URL` is Railway's own default role/database on this
  // instance, used only to bootstrap the real core_app/vault_app roles +
  // core_db/vault_db databases (see deploy notes) — CORE_DATABASE_URL/
  // VAULT_DATABASE_URL are set separately as secrets once those exist, not
  // referenced here.
  const db = postgres("core-db");
  const cache = redis("redis");

  // No `domains` set — Vault must never be publicly reachable, only
  // addressable from `api` over Railway's private network (RAILWAY_PRIVATE_DOMAIN).
  const vault = service("vault", {
    source: github(REPO, { branch: "mainbranch" }),
    build: "pnpm install --frozen-lockfile && pnpm --filter @datapay/vault... build",
    start: "node apps/vault/dist/main.js",
    env: {
      VAULT_PORT: "3001",
      RAILPACK_NODE_VERSION: "22",
      // Set out-of-band (railway variable set --stdin) — never written to
      // source. preserve() tells `config apply` to leave these alone rather
      // than delete them for not appearing here.
      VAULT_DATABASE_URL: preserve(),
      JWT_SECRET: preserve(),
      ALIAS_PEPPER: preserve(),
      VAULT_SECRET_KEY: preserve(),
      // Real SMS delivery (sms.util.ts) — falls back to a console log OTP
      // when either is unset, so this stays optional in dev/preview.
      MSG91_AUTH_KEY: preserve(),
      MSG91_OTP_TEMPLATE_ID: preserve(),
      // Firebase Phone Auth — the phone is proven on-device (mobile app);
      // this is what Vault verifies the resulting ID token against
      // (firebase-admin.util.ts). Full service-account JSON, one line.
      FIREBASE_SERVICE_ACCOUNT_JSON: preserve(),
    },
  });

  // No `domains` set either — members/portal never call `api` directly from
  // a browser in this architecture; portal proxies through Core API only
  // over the private network, same as vault.
  const api = service("api", {
    source: github(REPO, { branch: "mainbranch" }),
    build: "pnpm install --frozen-lockfile && pnpm --filter @datapay/api... build",
    start: "node apps/api/dist/main.js",
    env: {
      API_PORT: "3000",
      RAILPACK_NODE_VERSION: "22",
      REDIS_URL: cache.env.REDIS_URL,
      // A plain string containing Railway's OWN ${{service.VAR}} syntax —
      // NOT a JS template literal. `vault.env.RAILWAY_PRIVATE_DOMAIN` is a
      // {type:"reference"} object; embedding it in a JS template literal
      // stringifies to "[object Object]" (the bug that actually broke
      // portal's login — CORE_API_INTERNAL_URL had the same mistake).
      // Railway resolves ${{...}} server-side at deploy time, confirmed by
      // testing it directly against this project before writing this.
      VAULT_INTERNAL_URL: "http://${{vault.RAILWAY_PRIVATE_DOMAIN}}:3001",
      // Set out-of-band, never written to source — see vault's comment above.
      CORE_DATABASE_URL: preserve(),
      JWT_SECRET: preserve(),
      GEMINI_API_KEY: preserve(),
      GOOGLE_SERVICE_ACCOUNT_KEY: preserve(),
    },
  });

  // The only service that gets a public domain (added separately via
  // `railway domain` after apply) — the ops portal, SPEC.md §25.
  const portal = service("portal", {
    source: github(REPO, { branch: "mainbranch" }),
    build: "pnpm install --frozen-lockfile && pnpm --filter @datapay/portal... build",
    start: "pnpm --filter @datapay/portal start",
    env: {
      // See vault's comment above — plain string with Railway's own
      // ${{...}} syntax, not a JS template literal embedding a reference object.
      CORE_API_INTERNAL_URL: "http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3000",
      NODE_ENV: "production",
      RAILPACK_NODE_VERSION: "22",
      // Set out-of-band, never written to source — see vault's comment above.
      CORE_PORTAL_DATABASE_URL: preserve(),
      PORTAL_SESSION_SECRET: preserve(),
      PORTAL_ADMIN_PASSWORD: preserve(),
    },
  });

  return project("datapay", {
    resources: [db, cache, vault, api, portal],
  });
});
