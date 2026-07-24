export const shorthands = undefined;

// Region-scoped question delivery: a question with a zone_id is only ever
// shown to a member whose own zone is that zone or a descendant of it in the
// zones hierarchy (village ⊂ panchayat ⊂ hobli ⊂ constituency) — never to a
// sibling zone at the same level. NULL means "global" — every member sees it,
// same as every question before this migration behaved implicitly.
export const up = (pgm) => {
  pgm.addColumn("questions", {
    zone_id: { type: "uuid", references: "zones", onDelete: "set null" },
  });
  pgm.createIndex("questions", "zone_id");
};

export const down = (pgm) => {
  pgm.dropColumn("questions", "zone_id");
};
