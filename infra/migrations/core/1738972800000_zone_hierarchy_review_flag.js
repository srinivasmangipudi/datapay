export const shorthands = undefined;

// A zone auto-created from a geocoded location (SPEC.md §38) is real (a real
// place name, a real centroid) but its parent placement is a best guess, not
// verified — this flag is how ops finds those to fix without having to
// diff the whole zones table.
export const up = (pgm) => {
  pgm.addColumn("zones", {
    needs_hierarchy_review: { type: "boolean", notNull: true, default: false },
  });
};

export const down = (pgm) => {
  pgm.dropColumn("zones", "needs_hierarchy_review");
};
