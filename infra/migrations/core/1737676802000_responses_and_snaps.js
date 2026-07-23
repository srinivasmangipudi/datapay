export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable("responses", {
    id: { type: "serial", primaryKey: true },
    alias_id: { type: "text", notNull: true, references: "members", onDelete: "cascade" },
    question_id: { type: "integer", notNull: true, references: "questions", onDelete: "restrict" },
    option_ids: { type: "integer[]" },
    numeric_value: { type: "numeric" },
    input_mode: { type: "text", notNull: true, default: "tap", check: "input_mode IN ('tap','voice','snap')" },
    language: { type: "text", notNull: true },
    answered_at: { type: "timestamptz", notNull: true },
    // Offline-sync idempotency (SPEC.md §15C): the outbox retries; this makes retries free.
    client_msg_id: { type: "uuid", notNull: true, unique: true },
  });
  pgm.createIndex("responses", ["alias_id", "question_id"]);
  pgm.createIndex("responses", ["alias_id", "answered_at"]);

  pgm.createTable("snaps", {
    id: { type: "serial", primaryKey: true },
    alias_id: { type: "text", notNull: true, references: "members", onDelete: "cascade" },
    storage_key: { type: "text", notNull: true },
    product_code: { type: "text" },
    category_id: { type: "integer", references: "categories", onDelete: "set null" },
    state: {
      type: "text",
      notNull: true,
      default: "uploaded",
      check: "state IN ('uploaded','recognized','member_confirmed','ops_verified','rejected')",
    },
    reward_tokens: { type: "integer", notNull: true, default: 6 },
    client_msg_id: { type: "uuid", notNull: true, unique: true },
    captured_at: { type: "timestamptz", notNull: true },
    verified_at: { type: "timestamptz" },
  });
  pgm.createIndex("snaps", "alias_id");
};

export const down = (pgm) => {
  pgm.dropTable("snaps");
  pgm.dropTable("responses");
};
