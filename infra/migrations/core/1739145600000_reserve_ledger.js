export const shorthands = undefined;

export const up = (pgm) => {
  // SPEC.md §40 — the pitch deck's 50/20/30 split (tokens/fund/operations)
  // only ever had the fund's 20% slice built (§17's fund_ledger). This is the
  // 50% slice: real rupees reserved 1:1 against tokens the moment they're
  // realised (redeemed against a DELIVERED offer, not just redeemed — see
  // fund.service.ts's confirmDelivery(), the same event that already accrues
  // the fund). Global, not per-zone — unlike fund_ledger, tokens themselves
  // aren't zone-partitioned (members.token_balance isn't either).
  pgm.createTable("reserve_ledger", {
    id: { type: "serial", primaryKey: true },
    entry: { type: "text", notNull: true, check: "entry IN ('accrual')" },
    amount_paise: { type: "integer", notNull: true },
    ref_type: { type: "text", notNull: true },
    ref_id: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("reserve_ledger", "reserve_ledger_ref_unique", {
    unique: ["ref_type", "ref_id"],
  });

  // Same §15B append-only discipline as token_ledger/fund_ledger — real
  // rupees, no UPDATE/DELETE from any application role, ever.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION reject_reserve_ledger_mutation() RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'reserve_ledger is append-only — % is not permitted (SPEC.md §15B, applied to real rupees)', TG_OP;
    END;
    $$ LANGUAGE plpgsql;
  `);
  pgm.sql(`
    CREATE TRIGGER reserve_ledger_no_update
      BEFORE UPDATE ON reserve_ledger
      FOR EACH ROW EXECUTE FUNCTION reject_reserve_ledger_mutation();
  `);
  pgm.sql(`
    CREATE TRIGGER reserve_ledger_no_delete
      BEFORE DELETE ON reserve_ledger
      FOR EACH ROW EXECUTE FUNCTION reject_reserve_ledger_mutation();
  `);
};

export const down = (pgm) => {
  pgm.sql(`DROP TRIGGER IF EXISTS reserve_ledger_no_delete ON reserve_ledger;`);
  pgm.sql(`DROP TRIGGER IF EXISTS reserve_ledger_no_update ON reserve_ledger;`);
  pgm.sql(`DROP FUNCTION IF EXISTS reject_reserve_ledger_mutation();`);
  pgm.dropTable("reserve_ledger");
};
