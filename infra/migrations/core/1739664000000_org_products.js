export const shorthands = undefined;

// An organization's own product catalog — distinct from the ops-curated,
// deliberately "scrambled" `products` registry (§5B) that feeds
// offers/snaps/question_options. This is an org-owned concept: an org lists
// what IT sells, with real quantity/pricing/photos, browsable and orderable
// by members directly (reserve-only — no in-app payment, SPEC.md addendum).
export const up = (pgm) => {
  pgm.createTable("org_products", {
    id: { type: "serial", primaryKey: true },
    organization_id: { type: "uuid", notNull: true, references: "organizations", onDelete: "cascade" },
    category_id: { type: "integer", references: "categories", onDelete: "restrict" },
    name_en: { type: "text", notNull: true },
    name_kn: { type: "text" },
    description_en: { type: "text" },
    unit_spec: { type: "text" },
    market_price_paise: { type: "integer", notNull: true },
    sale_price_paise: { type: "integer", notNull: true },
    quantity_available: { type: "integer", notNull: true, default: 0 },
    photo_url: { type: "text" },
    // Normalized name (lowercase, trimmed, collapsed whitespace) — what makes
    // re-importing the same sheet an upsert instead of a duplicate insert.
    dedup_key: { type: "text", notNull: true },
    source: { type: "text", notNull: true, default: "manual", check: "source IN ('manual','sheet_extracted')" },
    // A genuinely new listing needs ops approval before it's orderable; a
    // re-import matching an already-approved row updates in place (routine
    // stock/price sync shouldn't need re-review every time).
    review_state: {
      type: "text",
      notNull: true,
      default: "draft",
      check: "review_state IN ('draft','approved','rejected')",
    },
    zone_id: { type: "uuid", references: "zones", onDelete: "restrict" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("org_products", "organization_id");
  pgm.createIndex("org_products", ["review_state", "zone_id"]);
  pgm.addConstraint("org_products", "org_products_org_dedup_unique", {
    unique: ["organization_id", "dedup_key"],
  });

  // One row per "point at a sheet" import — gives the org a visible history
  // of what happened, and something concrete to show in the portal UI.
  pgm.createTable("org_product_import_runs", {
    id: { type: "serial", primaryKey: true },
    organization_id: { type: "uuid", notNull: true, references: "organizations", onDelete: "cascade" },
    source_url: { type: "text", notNull: true },
    status: { type: "text", notNull: true, default: "running", check: "status IN ('running','completed','failed')" },
    products_found: { type: "integer", notNull: true, default: 0 },
    products_created: { type: "integer", notNull: true, default: 0 },
    products_updated: { type: "integer", notNull: true, default: 0 },
    error_message: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("org_product_import_runs", "organization_id");

  // Reserve-only ordering (no in-app payment): a member reserves a quantity,
  // the org fulfills outside the app. Identity-blind by design, same as
  // offer_participation (§7) — alias_id exists here for the member's own
  // "my orders" view and for the locking/decrement transaction, but is never
  // selected in any org-facing query; relay_token is what an org sees.
  pgm.createTable("product_orders", {
    id: { type: "serial", primaryKey: true },
    org_product_id: { type: "integer", notNull: true, references: "org_products", onDelete: "restrict" },
    alias_id: { type: "text", notNull: true, references: "members", onDelete: "cascade" },
    relay_token: { type: "uuid", notNull: true, unique: true },
    quantity: { type: "integer", notNull: true, default: 1 },
    // Snapshot of sale_price_paise at order time — a later price edit must
    // never retroactively change what a past order shows as its price.
    unit_price_paise: { type: "integer", notNull: true },
    status: { type: "text", notNull: true, default: "placed", check: "status IN ('placed','fulfilled','cancelled')" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("product_orders", "org_product_id");
  pgm.createIndex("product_orders", "alias_id");
};

export const down = (pgm) => {
  pgm.dropTable("product_orders");
  pgm.dropTable("org_product_import_runs");
  pgm.dropTable("org_products");
};
