export const shorthands = undefined;

// Auto-generated demand-intent questions: every org product should have a
// matching "would you buy this" question, so ties a question back to the
// org_product that spawned it. The review gate is unchanged (SPEC.md §14) —
// these land as review_state='draft' exactly like every other generated
// question, never auto-approved just because the source was deterministic.
export const up = (pgm) => {
  pgm.addColumn("questions", {
    org_product_id: {
      type: "integer",
      references: "org_products",
      onDelete: "SET NULL",
    },
  });

  pgm.dropConstraint("questions", "questions_source_check");
  pgm.addConstraint("questions", "questions_source_check", {
    check: "source IN ('admin_authored','plugin_generated','org_submitted','product_generated')",
  });

  // A generic home-ground category for the kind of climate-tech/appliance
  // hardware org catalogs (Prakruti Plus's solar/cookstove lineup, and
  // presumably future orgs) don't fit any of the existing grocery-style
  // categories. Published like the other real product categories so it can
  // surface in the public demand registry too.
  pgm.sql(`
    INSERT INTO categories (slug, name, name_kn, sensitivity, kind, published)
    VALUES ('clean-energy-appliances', 'Clean energy & appliances', 'ಶುದ್ಧ ಶಕ್ತಿ ಮತ್ತು ಉಪಕರಣಗಳು', 'standard', 'product', true)
  `);
};

export const down = (pgm) => {
  pgm.sql(`DELETE FROM categories WHERE slug = 'clean-energy-appliances'`);

  pgm.dropConstraint("questions", "questions_source_check");
  pgm.addConstraint("questions", "questions_source_check", {
    check: "source IN ('admin_authored','plugin_generated','org_submitted')",
  });

  pgm.dropColumn("questions", "org_product_id");
};
