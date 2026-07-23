export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable("demand_aggregates", {
    id: { type: "serial", primaryKey: true },
    category_id: { type: "integer", notNull: true, references: "categories", onDelete: "restrict" },
    zone_id: { type: "uuid", notNull: true, references: "zones", onDelete: "restrict" },
    window: { type: "text", notNull: true },
    metric: { type: "jsonb", notNull: true },
    // LAW 3, in the schema: no row describing fewer than 50 members can exist,
    // full stop — this is the second enforcement point alongside the job/API check.
    cohort_size: { type: "integer", notNull: true, check: "cohort_size >= 50" },
    computed_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("demand_aggregates", ["category_id", "zone_id"]);

  pgm.createTable("token_rate", {
    id: { type: "serial", primaryKey: true },
    effective_from: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    effective_to: { type: "timestamptz" },
    rate_paise: { type: "numeric", notNull: true },
    inputs: { type: "jsonb", notNull: true },
    computed_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

export const down = (pgm) => {
  pgm.dropTable("token_rate");
  pgm.dropTable("demand_aggregates");
};
