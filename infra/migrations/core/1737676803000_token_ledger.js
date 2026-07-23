export const shorthands = undefined;

export const up = (pgm) => {
  pgm.addColumn("members", {
    token_balance: { type: "integer", notNull: true, default: 0 },
  });
  pgm.addConstraint("members", "members_token_balance_nonnegative", {
    check: "token_balance >= 0",
  });

  pgm.createTable("token_ledger", {
    id: { type: "serial", primaryKey: true },
    // RESTRICT, not CASCADE: the immutability trigger below blocks every DELETE,
    // including ones a cascade would attempt — so a member can never actually be
    // deleted while ledger rows exist. RESTRICT surfaces that as a clear FK error
    // instead of a confusing trigger exception bubbling up through a cascade.
    // Compliant member deletion (§11) must anonymize/orphan, never cascade through here.
    alias_id: { type: "text", notNull: true, references: "members", onDelete: "restrict" },
    entry: {
      type: "text",
      notNull: true,
      check:
        "entry IN ('earn_response','earn_snap','earn_voice','earn_intent','earn_bonus','redeem_offer','expire','adjustment')",
    },
    tokens: { type: "integer", notNull: true },
    ref_type: { type: "text", notNull: true },
    ref_id: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("token_ledger", "alias_id");
  // SPEC.md §15C: the idempotency key IS the source row's own id — a retried
  // offline sync can never double-credit, by constraint, not by convention.
  pgm.addConstraint("token_ledger", "token_ledger_ref_unique", {
    unique: ["ref_type", "ref_id"],
  });

  // SPEC.md §15B: append-only, enforced at the database — not just by convention.
  // No application role, however privileged, may UPDATE or DELETE a ledger row.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION reject_token_ledger_mutation() RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'token_ledger is append-only — % is not permitted (SPEC.md §15B)', TG_OP;
    END;
    $$ LANGUAGE plpgsql;
  `);
  pgm.sql(`
    CREATE TRIGGER token_ledger_no_update
      BEFORE UPDATE ON token_ledger
      FOR EACH ROW EXECUTE FUNCTION reject_token_ledger_mutation();
  `);
  pgm.sql(`
    CREATE TRIGGER token_ledger_no_delete
      BEFORE DELETE ON token_ledger
      FOR EACH ROW EXECUTE FUNCTION reject_token_ledger_mutation();
  `);
};

export const down = (pgm) => {
  pgm.sql(`DROP TRIGGER IF EXISTS token_ledger_no_delete ON token_ledger;`);
  pgm.sql(`DROP TRIGGER IF EXISTS token_ledger_no_update ON token_ledger;`);
  pgm.sql(`DROP FUNCTION IF EXISTS reject_token_ledger_mutation();`);
  pgm.dropTable("token_ledger");
  pgm.dropConstraint("members", "members_token_balance_nonnegative");
  pgm.dropColumn("members", "token_balance");
};
