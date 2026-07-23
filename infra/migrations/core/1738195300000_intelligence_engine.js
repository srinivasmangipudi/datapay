export const shorthands = undefined;

// "Area intelligence" question engine: documents ingested from an external
// source (Google Drive, per source) feed a per-zone "understanding" (a
// structured knowledge map + narrative summary), which in turn grounds a new
// question_topics generator kind. Everything this generates still lands in
// the EXISTING draft review queue (questions.review_state) — nothing here
// bypasses the review gate SPEC.md §14 already established.
export const up = (pgm) => {
  pgm.createTable("intelligence_sources", {
    id: { type: "serial", primaryKey: true },
    zone_id: { type: "uuid", notNull: true, references: "zones", onDelete: "cascade" },
    kind: { type: "text", notNull: true, check: "kind IN ('google_drive_folder')" },
    external_ref: { type: "text", notNull: true },
    display_name: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    last_synced_at: { type: "timestamptz" },
  });
  pgm.createIndex("intelligence_sources", "zone_id");

  // content_hash lets a resync skip documents that haven't changed since
  // last time, instead of re-extracting/re-storing identical text.
  pgm.createTable("intelligence_documents", {
    id: { type: "serial", primaryKey: true },
    source_id: { type: "integer", notNull: true, references: "intelligence_sources", onDelete: "cascade" },
    external_id: { type: "text", notNull: true },
    title: { type: "text", notNull: true },
    mime_type: { type: "text" },
    content_text: { type: "text" },
    content_hash: { type: "text" },
    fetched_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("intelligence_documents", "intelligence_documents_source_external_unique", {
    unique: ["source_id", "external_id"],
  });

  // No UNIQUE(zone_id) — a new understanding is a new row, not an overwrite,
  // so "how the model's read on this area changed over time" stays visible
  // rather than being silently replaced.
  pgm.createTable("zone_understanding", {
    id: { type: "serial", primaryKey: true },
    zone_id: { type: "uuid", notNull: true, references: "zones", onDelete: "cascade" },
    summary_en: { type: "text" },
    summary_kn: { type: "text" },
    knowledge_map: { type: "jsonb", notNull: true, default: "{}" },
    source_document_ids: { type: "integer[]", notNull: true, default: "{}" },
    model_used: { type: "text", notNull: true },
    generated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("zone_understanding", ["zone_id", "generated_at"]);

  // document_grounded topics need a zone (whose understanding grounds the
  // prompt); template topics don't — enforced in app code, not a DB CHECK,
  // since the requirement is conditional on generator_kind.
  pgm.addColumn("question_topics", {
    zone_id: { type: "uuid", references: "zones", onDelete: "set null" },
  });

  pgm.sql(`ALTER TABLE question_topics DROP CONSTRAINT question_topics_generator_kind_check`);
  pgm.addConstraint("question_topics", "question_topics_generator_kind_check", {
    check: "generator_kind IN ('template','llm_assisted','document_grounded')",
  });
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE question_topics DROP CONSTRAINT question_topics_generator_kind_check`);
  pgm.addConstraint("question_topics", "question_topics_generator_kind_check", {
    check: "generator_kind IN ('template','llm_assisted')",
  });
  pgm.dropColumn("question_topics", "zone_id");
  pgm.dropTable("zone_understanding");
  pgm.dropTable("intelligence_documents");
  pgm.dropTable("intelligence_sources");
};
