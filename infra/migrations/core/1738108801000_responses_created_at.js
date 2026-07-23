export const shorthands = undefined;

// Velocity capping (§6 fraud engine) needs a server-set insertion timestamp.
// `answered_at` is client-supplied and legitimately backdated by the offline
// outbox, so it can't anchor a rate limit — a spammer would just set it to
// the past. `created_at` is what the DB actually saw and when.
export const up = (pgm) => {
  pgm.addColumn("responses", {
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("responses", ["alias_id", "created_at"]);
};

export const down = (pgm) => {
  pgm.dropColumn("responses", "created_at");
};
