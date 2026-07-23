export const shorthands = undefined;

export const up = (pgm) => {
  // Real rupees, not closed-loop tokens — if anything this deserves MORE of
  // §15's payments-grade rigor than token_ledger, not less. Same discipline:
  // append-only (enforced by trigger, not convention), idempotent via
  // UNIQUE(ref_type, ref_id).
  pgm.createTable("fund_ledger", {
    id: { type: "serial", primaryKey: true },
    zone_id: { type: "uuid", notNull: true, references: "zones", onDelete: "restrict" },
    entry: { type: "text", notNull: true, check: "entry IN ('accrual','project_disbursement')" },
    amount_paise: { type: "integer", notNull: true },
    ref_type: { type: "text", notNull: true },
    ref_id: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("fund_ledger", "zone_id");
  pgm.addConstraint("fund_ledger", "fund_ledger_ref_unique", {
    unique: ["ref_type", "ref_id"],
  });

  pgm.sql(`
    CREATE OR REPLACE FUNCTION reject_fund_ledger_mutation() RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'fund_ledger is append-only — % is not permitted (SPEC.md §15B, applied to real rupees)', TG_OP;
    END;
    $$ LANGUAGE plpgsql;
  `);
  pgm.sql(`
    CREATE TRIGGER fund_ledger_no_update
      BEFORE UPDATE ON fund_ledger
      FOR EACH ROW EXECUTE FUNCTION reject_fund_ledger_mutation();
  `);
  pgm.sql(`
    CREATE TRIGGER fund_ledger_no_delete
      BEFORE DELETE ON fund_ledger
      FOR EACH ROW EXECUTE FUNCTION reject_fund_ledger_mutation();
  `);

  pgm.createTable("fund_projects", {
    id: { type: "serial", primaryKey: true },
    zone_id: { type: "uuid", notNull: true, references: "zones", onDelete: "restrict" },
    title: { type: "text", notNull: true },
    title_kn: { type: "text" },
    estimate_paise: { type: "integer", notNull: true },
    status: {
      type: "text",
      notNull: true,
      default: "proposed",
      check: "status IN ('proposed','voting','approved','funded','done')",
    },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("fund_projects", "zone_id");

  // 1 member, 1 vote — the UNIQUE constraint IS the acceptance test (SPEC.md §12 Phase 5).
  pgm.createTable("fund_votes", {
    id: { type: "serial", primaryKey: true },
    project_id: { type: "integer", notNull: true, references: "fund_projects", onDelete: "cascade" },
    alias_id: { type: "text", notNull: true, references: "members", onDelete: "cascade" },
    vote: { type: "text", notNull: true, check: "vote IN ('yes','no')" },
    at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("fund_votes", "fund_votes_project_alias_unique", {
    unique: ["project_id", "alias_id"],
  });
};

export const down = (pgm) => {
  pgm.dropTable("fund_votes");
  pgm.dropTable("fund_projects");
  pgm.sql(`DROP TRIGGER IF EXISTS fund_ledger_no_delete ON fund_ledger;`);
  pgm.sql(`DROP TRIGGER IF EXISTS fund_ledger_no_update ON fund_ledger;`);
  pgm.sql(`DROP FUNCTION IF EXISTS reject_fund_ledger_mutation();`);
  pgm.dropTable("fund_ledger");
};
