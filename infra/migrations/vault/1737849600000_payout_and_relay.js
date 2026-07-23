export const shorthands = undefined;

export const up = (pgm) => {
  // Producers only — resolved in batch at payout execution, never exposed live.
  pgm.createTable("payout_instruments", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    upi_id_encrypted: { type: "text", notNull: true },
    verified_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("payout_instruments", "user_id");

  pgm.createTable("delivery_addresses", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    address_encrypted: { type: "text", notNull: true },
    zone_hint: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("delivery_addresses", "user_id");

  // §7: the ONLY thing Core ever hands a member for pickup — a random token
  // that means nothing without a resolve-relay call INTO Vault. Purges 30
  // days after completion (§7); nothing here is kept longer than fulfillment needs.
  pgm.createTable("relay_map", {
    relay_token: { type: "uuid", primaryKey: true },
    delivery_address_id: { type: "uuid", notNull: true, references: "delivery_addresses", onDelete: "restrict" },
    offer_ref: { type: "text", notNull: true },
    expires_at: { type: "timestamptz", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

export const down = (pgm) => {
  pgm.dropTable("relay_map");
  pgm.dropTable("delivery_addresses");
  pgm.dropTable("payout_instruments");
};
