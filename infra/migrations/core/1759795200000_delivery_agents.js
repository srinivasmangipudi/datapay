export const shorthands = undefined;

// Delivery people, onboarded by ops and scoped to an area.
//
// Note what is NOT here: their phone number. LAW 1 keeps every phone out of
// core_db without exception, and there is a test that greps these very files to
// enforce it (db/no-phone-in-core.integration.spec.ts) — it caught the first
// version of this migration, correctly. The number lives in
// vault.delivery_agent_phones, keyed by the id below, and Vault resolves a
// phone to an agent at sign-in exactly as it resolves an alias to a device or
// a UPI ID everywhere else.
//
// The rest is in Core because it is not identity: a delivery agent is a
// counterparty, like an organization, and what they cover and whether they are
// active are operational facts ops reads constantly.
export const up = (pgm) => {
  pgm.createTable("delivery_agents", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    name: { type: "text", notNull: true },
    // The area they cover. A zone, so it reuses the hierarchy that questions,
    // products and members are already scoped by — an agent for a taluk covers
    // every village under it without a row per village.
    zone_id: { type: "uuid", notNull: true, references: "zones", onDelete: "restrict" },
    password_hash: { type: "text", notNull: true },
    // Ops can stand someone down without deleting them and losing the record
    // of what they delivered.
    active: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("delivery_agents", "zone_id");

  // Created by migrate-prod.mjs as the superuser, so the app role cannot touch
  // it without this — see vault/1759622400000_grant_new_tables_to_vault_app.js
  // for what forgetting it cost last time.
  pgm.sql(`GRANT SELECT, INSERT, UPDATE, DELETE ON delivery_agents TO core_app;`);
};

export const down = (pgm) => {
  pgm.dropTable("delivery_agents");
};
