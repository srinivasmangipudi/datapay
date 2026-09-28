export const shorthands = undefined;

// push_tokens and payout_refs were created by infra/migrate-prod.mjs, which
// connects as the SUPERUSER (Railway's DATABASE_PUBLIC_URL). Every earlier
// vault table was created by a migration run as `vault_app`, so it owned them
// and needed no grant — these two ended up owned by `postgres`, and the running
// Vault service could not read or write them at all.
//
// The symptom was a flat 500 on device registration ("permission denied for
// table push_tokens"). payout_refs had the SAME defect and nobody had noticed,
// because no payout has ever run in production — it would have failed on the
// first one.
//
// core_db already hit this and solved it with explicit grants
// (1739750400000_grant_org_products_to_core_app.js), so this follows that
// convention rather than reassigning ownership.
const TABLES = ["push_tokens", "payout_refs"];

export const up = (pgm) => {
  for (const table of TABLES) {
    // IF EXISTS-ish: a fresh local database created entirely by vault_app
    // already owns these, and granting an owner its own table is a harmless
    // no-op, so this is safe in both environments.
    pgm.sql(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO vault_app;`);
  }
};

export const down = (pgm) => {
  for (const table of TABLES) {
    pgm.sql(`REVOKE SELECT, INSERT, UPDATE, DELETE ON ${table} FROM vault_app;`);
  }
};
