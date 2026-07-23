export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable("consents", {
    id: { type: "serial", primaryKey: true },
    alias_id: { type: "text", notNull: true, references: "members", onDelete: "cascade" },
    category_id: { type: "integer", notNull: true, references: "categories", onDelete: "restrict" },
    granted: { type: "boolean", notNull: true },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("consents", "consents_alias_category_unique", {
    unique: ["alias_id", "category_id"],
  });

  // Immutable audit trail — every grant/revoke, never edited.
  pgm.createTable("consent_events", {
    id: { type: "serial", primaryKey: true },
    alias_id: { type: "text", notNull: true, references: "members", onDelete: "cascade" },
    category_id: { type: "integer", notNull: true, references: "categories", onDelete: "restrict" },
    action: { type: "text", notNull: true, check: "action IN ('grant','revoke')" },
    at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("consent_events", ["alias_id", "category_id"]);
};

export const down = (pgm) => {
  pgm.dropTable("consent_events");
  pgm.dropTable("consents");
};
