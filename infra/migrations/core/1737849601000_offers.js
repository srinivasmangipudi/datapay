export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable("pacs_nodes", {
    id: { type: "serial", primaryKey: true },
    zone_id: { type: "uuid", notNull: true, references: "zones", onDelete: "restrict" },
    kind: { type: "text", notNull: true, check: "kind IN ('pacs','rwa','society')" },
    name: { type: "text", notNull: true },
    godown_capacity_note: { type: "text" },
    operator_contact_ref: { type: "text" },
    active: { type: "boolean", notNull: true, default: true },
  });
  pgm.createIndex("pacs_nodes", "zone_id");

  pgm.createTable("offers", {
    id: { type: "serial", primaryKey: true },
    product_code: { type: "text", notNull: true, references: "products", onDelete: "restrict" },
    zone_id: { type: "uuid", notNull: true, references: "zones", onDelete: "restrict" },
    pacs_node_id: { type: "integer", references: "pacs_nodes", onDelete: "restrict" },
    collective_price_paise: { type: "integer", notNull: true },
    market_price_paise: { type: "integer", notNull: true },
    min_participants: { type: "integer", notNull: true, default: 1 },
    max_participants: { type: "integer" },
    opens_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    closes_at: { type: "timestamptz", notNull: true },
    status: {
      type: "text",
      notNull: true,
      default: "open",
      check: "status IN ('draft','open','locked','fulfilled','cancelled')",
    },
    brand_code: { type: "text", references: "brands", onDelete: "set null" },
  });
  pgm.createIndex("offers", ["zone_id", "status"]);

  // §6, LAW 2 pricing — set by the token-rate job (§6C), never hand-edited.
  pgm.createTable("offer_token_terms", {
    offer_id: { type: "integer", primaryKey: true, references: "offers", onDelete: "cascade" },
    max_tokens_redeemable: { type: "integer", notNull: true },
    token_value_paise: { type: "integer", notNull: true },
    set_by: { type: "text", notNull: true, default: "token-rate-job" },
    computed_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("offer_participation", {
    id: { type: "serial", primaryKey: true },
    offer_id: { type: "integer", notNull: true, references: "offers", onDelete: "restrict" },
    alias_id: { type: "text", notNull: true, references: "members", onDelete: "cascade" },
    qty: { type: "integer", notNull: true, default: 1 },
    tokens_redeemed: { type: "integer", notNull: true, default: 0 },
    joined_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    state: {
      type: "text",
      notNull: true,
      default: "joined",
      check: "state IN ('joined','confirmed','delivered','cancelled')",
    },
    // Identity-blind fulfillment (§7): the ONLY thing a supplier or PACS node
    // ever sees to identify a pickup. Never the alias, never the address.
    relay_token: { type: "uuid", notNull: true, unique: true },
  });
  pgm.createIndex("offer_participation", ["offer_id", "alias_id"]);
  pgm.addConstraint("offer_participation", "offer_participation_offer_alias_unique", {
    unique: ["offer_id", "alias_id"],
  });
};

export const down = (pgm) => {
  pgm.dropTable("offer_participation");
  pgm.dropTable("offer_token_terms");
  pgm.dropTable("offers");
  pgm.dropTable("pacs_nodes");
};
