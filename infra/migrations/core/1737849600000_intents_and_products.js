export const shorthands = undefined;

export const up = (pgm) => {
  // Only meaningful on type='intent_window' questions — the window the
  // question itself declares (e.g. "in the next month" = '1m'), not something
  // the member picks. NULL for every other question type.
  pgm.addColumn("questions", {
    intent_window: { type: "text", check: "intent_window IN ('1m','3m','6m','12m')" },
  });
  // Backfill the pilot's one intent_window question, seeded before this column existed.
  pgm.sql(`
    UPDATE questions SET intent_window = '1m'
    WHERE type = 'intent_window' AND text_en = 'Do you plan to buy sugar in the next month?'
  `);

  // LAW 2's other half: tokens redeem only against demand a member declared
  // themselves. One row per declared intent; fulfilled_offer_id is set once,
  // by the redemption gate, never edited back to NULL.
  pgm.createTable("intents", {
    id: { type: "serial", primaryKey: true },
    alias_id: { type: "text", notNull: true, references: "members", onDelete: "cascade" },
    product_category_id: { type: "integer", notNull: true, references: "categories", onDelete: "restrict" },
    window: { type: "text", notNull: true, check: `"window" IN ('1m','3m','6m','12m')` },
    strength: { type: "text", notNull: true, check: "strength IN ('yes','maybe')" },
    declared_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    expires_at: { type: "timestamptz", notNull: true },
    fulfilled_offer_id: { type: "integer" },
  });
  pgm.createIndex("intents", ["alias_id", "product_category_id"]);
  // The redemption gate's whole query shape: "does an unfulfilled, unexpired
  // intent exist for this alias + category" — this index is that query.
  pgm.createIndex("intents", ["alias_id", "product_category_id", "fulfilled_offer_id", "expires_at"]);

  pgm.createTable("brands", {
    brand_code: { type: "text", primaryKey: true },
    display_name: { type: "text", notNull: true },
  });

  // Scrambled by design (SPEC.md §5B) — real brand identity lives in the
  // portal/ops side, not here; core_db only needs a stable, opaque code.
  pgm.createTable("products", {
    product_code: { type: "text", primaryKey: true },
    category_id: { type: "integer", notNull: true, references: "categories", onDelete: "restrict" },
    display_name: { type: "text", notNull: true },
    display_name_kn: { type: "text" },
    brand_code: { type: "text", references: "brands", onDelete: "set null" },
    unit_spec: { type: "text" },
    mrp_paise: { type: "integer" },
  });
  pgm.createIndex("products", "category_id");
};

export const down = (pgm) => {
  pgm.dropTable("products");
  pgm.dropTable("brands");
  pgm.dropTable("intents");
  pgm.dropColumn("questions", "intent_window");
};
