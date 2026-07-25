export const shorthands = undefined;

// Closes the "uploaded → recognized" gap in SPEC.md's Snap state chain
// (§8.4) — a vision call tags what's actually in the photo, before ops ever
// looks at it.
export const up = (pgm) => {
  pgm.addColumn("snaps", {
    recognized_tags: { type: "text[]" },
    recognized_label: { type: "text" },
    recognized_confidence: { type: "numeric" },
    recognized_at: { type: "timestamptz" },
    // AI's own guess, kept separate from the member-declared category_id
    // above — ops-assist only, never silently overwrites what the member
    // actually chose (or left blank).
    recognized_product_guess: { type: "text" },
    recognized_category_id: { type: "integer", references: "categories", onDelete: "set null" },
  });
};

export const down = (pgm) => {
  pgm.dropColumn("snaps", [
    "recognized_tags",
    "recognized_label",
    "recognized_confidence",
    "recognized_at",
    "recognized_product_guess",
    "recognized_category_id",
  ]);
};
