export const shorthands = undefined;

// Organizations: a distinct, credentialed account type so a company can log
// in and submit its own questions — separate from the ops team's single
// shared portal password. Org-submitted questions always land as 'draft'
// (same review queue every generated question already goes through, SPEC.md
// §14) — an org typing a question in is NOT the review, unlike an
// admin_authored one; ops still approves before it can ever reach a member.
export const up = (pgm) => {
  pgm.createTable("organizations", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    slug: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    email: { type: "text", notNull: true, unique: true },
    password_hash: { type: "text", notNull: true },
    active: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.addColumn("questions", {
    organization_id: {
      type: "uuid",
      references: "organizations",
      onDelete: "SET NULL",
    },
  });

  pgm.dropConstraint("questions", "questions_source_check");
  pgm.addConstraint("questions", "questions_source_check", {
    check: "source IN ('admin_authored','plugin_generated','org_submitted')",
  });
};

export const down = (pgm) => {
  pgm.dropConstraint("questions", "questions_source_check");
  pgm.addConstraint("questions", "questions_source_check", {
    check: "source IN ('admin_authored','plugin_generated')",
  });
  pgm.dropColumn("questions", "organization_id");
  pgm.dropTable("organizations");
};
