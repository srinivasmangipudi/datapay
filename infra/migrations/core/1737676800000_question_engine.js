export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable("categories", {
    id: { type: "serial", primaryKey: true },
    slug: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    name_kn: { type: "text" },
    // §2: seed data must never include health/religion/caste/political categories.
    // 'none' means "no sensitivity concerns" — there is no sensitive tier by design.
    sensitivity: { type: "text", notNull: true, default: "standard", check: "sensitivity IN ('standard','none')" },
  });

  pgm.createTable("questions", {
    id: { type: "serial", primaryKey: true },
    category_id: { type: "integer", notNull: true, references: "categories", onDelete: "restrict" },
    type: {
      type: "text",
      notNull: true,
      check: "type IN ('single','multi','yesno','intent_window','numeric')",
    },
    text_en: { type: "text", notNull: true },
    text_kn: { type: "text" },
    reward_tokens: { type: "integer", notNull: true, default: 4 },
    active_from: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    active_to: { type: "timestamptz" },
    max_audience: { type: "integer" },
    frequency_rule: { type: "text" },
    // Question Feeder Engine (SPEC.md §14) — a machine can draft a question,
    // only a review step can publish it.
    source: { type: "text", notNull: true, default: "admin_authored", check: "source IN ('admin_authored','plugin_generated')" },
    generator_topic_id: { type: "integer" },
    generation_run_id: { type: "integer" },
    review_state: { type: "text", notNull: true, default: "approved", check: "review_state IN ('draft','approved','rejected')" },
  });
  pgm.createIndex("questions", "category_id");
  pgm.createIndex("questions", ["review_state", "active_from", "active_to"]);

  pgm.createTable("question_options", {
    id: { type: "serial", primaryKey: true },
    question_id: { type: "integer", notNull: true, references: "questions", onDelete: "cascade" },
    product_code: { type: "text" },
    label_en: { type: "text", notNull: true },
    label_kn: { type: "text" },
    sort: { type: "integer", notNull: true, default: 0 },
  });
  pgm.createIndex("question_options", "question_id");

  pgm.createTable("question_topics", {
    id: { type: "serial", primaryKey: true },
    slug: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    category_id: { type: "integer", notNull: true, references: "categories", onDelete: "restrict" },
    generator_kind: { type: "text", notNull: true, check: "generator_kind IN ('template','llm_assisted')" },
    config: { type: "jsonb", notNull: true, default: "{}" },
    schedule_cron: { type: "text" },
    active: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("question_generation_runs", {
    id: { type: "serial", primaryKey: true },
    topic_id: { type: "integer", notNull: true, references: "question_topics", onDelete: "cascade" },
    triggered_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    status: { type: "text", notNull: true, default: "running", check: "status IN ('running','completed','failed')" },
    questions_generated: { type: "integer", notNull: true, default: 0 },
    completed_at: { type: "timestamptz" },
  });

  pgm.addConstraint("questions", "questions_generator_topic_id_fkey", {
    foreignKeys: { columns: "generator_topic_id", references: "question_topics", onDelete: "set null" },
  });
  pgm.addConstraint("questions", "questions_generation_run_id_fkey", {
    foreignKeys: { columns: "generation_run_id", references: "question_generation_runs", onDelete: "set null" },
  });
};

export const down = (pgm) => {
  pgm.dropTable("question_generation_runs");
  pgm.dropTable("question_topics");
  pgm.dropTable("question_options");
  pgm.dropTable("questions");
  pgm.dropTable("categories");
};
