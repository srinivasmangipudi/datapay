export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable("produce_categories", {
    id: { type: "serial", primaryKey: true },
    slug: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    name_kn: { type: "text" },
    unit: {
      type: "text",
      notNull: true,
      check: "unit IN ('kg','quintal','litre','piece','acre_yield')",
    },
  });

  pgm.createTable("shg_groups", {
    id: { type: "serial", primaryKey: true },
    name: { type: "text", notNull: true },
    zone_id: { type: "uuid", notNull: true, references: "zones", onDelete: "restrict" },
    member_count: { type: "integer", notNull: true, default: 0 },
  });

  // Producer identity is still pseudonymous (alias_id), same as every other
  // member-facing table — the marketplace doesn't get a lesser guarantee.
  pgm.createTable("producer_profiles", {
    alias_id: { type: "text", primaryKey: true, references: "members", onDelete: "cascade" },
    kind: { type: "text", notNull: true, check: "kind IN ('farmer','shg','artisan','micro_unit')" },
    shg_id: { type: "integer", references: "shg_groups", onDelete: "set null" },
    capacity_note: { type: "text" },
    active: { type: "boolean", notNull: true, default: true },
  });

  pgm.createTable("produce_listings", {
    id: { type: "serial", primaryKey: true },
    alias_id: { type: "text", notNull: true, references: "producer_profiles", onDelete: "cascade" },
    produce_category_id: { type: "integer", notNull: true, references: "produce_categories", onDelete: "restrict" },
    qty: { type: "numeric", notNull: true },
    unit: {
      type: "text",
      notNull: true,
      check: "unit IN ('kg','quintal','litre','piece','acre_yield')",
    },
    quality_note: { type: "text" },
    ready_at: { type: "timestamptz" },
    snap_ids: { type: "integer[]" },
    input_mode: { type: "text", notNull: true, default: "tap", check: "input_mode IN ('tap','voice','snap')" },
    state: {
      type: "text",
      notNull: true,
      default: "listed",
      check: "state IN ('draft','listed','matched','deal_agreed','fulfilled','withdrawn')",
    },
    asking_price_paise: { type: "integer" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("produce_listings", ["produce_category_id", "state"]);
};

export const down = (pgm) => {
  pgm.dropTable("produce_listings");
  pgm.dropTable("producer_profiles");
  pgm.dropTable("shg_groups");
  pgm.dropTable("produce_categories");
};
