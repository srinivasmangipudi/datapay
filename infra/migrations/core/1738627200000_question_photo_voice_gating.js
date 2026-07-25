export const shorthands = undefined;

// The generic, question-independent "Snap" feature is being retired from the
// member-facing app in favor of photo/voice as answer modes on a SPECIFIC
// question, gated by whoever authored it. Both default true — "on by
// default," per the ask — so existing questions keep accepting both until an
// admin deliberately turns one off.
export const up = (pgm) => {
  pgm.addColumn("questions", {
    allow_photo: { type: "boolean", notNull: true, default: true },
    allow_voice: { type: "boolean", notNull: true, default: true },
  });

  // Same recognition shape as snaps (1738540800000_snap_recognition.js) —
  // a photo attached to a response gets tagged the same way, stored on the
  // response itself rather than a free-floating snap row.
  pgm.addColumn("responses", {
    recognized_tags: { type: "text[]" },
    recognized_label: { type: "text" },
    recognized_confidence: { type: "numeric" },
    recognized_product_guess: { type: "text" },
    recognized_category_id: { type: "integer", references: "categories", onDelete: "set null" },
    recognized_at: { type: "timestamptz" },
  });
};

export const down = (pgm) => {
  pgm.dropColumn("responses", [
    "recognized_tags",
    "recognized_label",
    "recognized_confidence",
    "recognized_product_guess",
    "recognized_category_id",
    "recognized_at",
  ]);
  pgm.dropColumn("questions", ["allow_photo", "allow_voice"]);
};
