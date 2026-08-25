export const shorthands = undefined;

// TOKEN_ECONOMY_REDESIGN.md — replaces SPEC.md §40 entirely. Every token is
// now equal (no issued/realised/actualised state); reserve_ledger's whole
// premise (a real rupee reserved 1:1 against redeemed tokens at delivery)
// no longer exists. Its bookkeeping was never backed by real money anyway —
// dropped clean, not deprecated in place.
export const up = async (pgm) => {
  pgm.sql(`DROP TRIGGER IF EXISTS reserve_ledger_no_delete ON reserve_ledger;`);
  pgm.sql(`DROP TRIGGER IF EXISTS reserve_ledger_no_update ON reserve_ledger;`);
  pgm.sql(`DROP FUNCTION IF EXISTS reject_reserve_ledger_mutation();`);
  pgm.dropTable("reserve_ledger");

  // The new revenue mechanism: a supplier pays 2% of the sale price into
  // this corpus on every confirmed delivery. The corpus is never spent down
  // — only its eventual investment returns get distributed as dividends
  // (not yet built; see TOKEN_ECONOMY_REDESIGN.md's open questions on
  // cadence and the real banking/legal entity this eventually needs).
  // Global, not per-zone, same reasoning as the old reserve_ledger — tokens
  // themselves aren't zone-partitioned — though whether the corpus should
  // eventually split per-zone (matching the "buy local first" origin) is
  // one of those open questions, deliberately not decided here.
  pgm.createTable("corpus_fund_ledger", {
    id: { type: "serial", primaryKey: true },
    entry: { type: "text", notNull: true, check: "entry IN ('contribution')" },
    amount_paise: { type: "integer", notNull: true },
    ref_type: { type: "text", notNull: true },
    ref_id: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("corpus_fund_ledger", "corpus_fund_ledger_ref_unique", {
    unique: ["ref_type", "ref_id"],
  });
  pgm.sql(`
    CREATE OR REPLACE FUNCTION reject_corpus_fund_ledger_mutation() RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'corpus_fund_ledger is append-only — % is not permitted (SPEC.md §15B, applied to real rupees)', TG_OP;
    END;
    $$ LANGUAGE plpgsql;
  `);
  pgm.sql(`
    CREATE TRIGGER corpus_fund_ledger_no_update
      BEFORE UPDATE ON corpus_fund_ledger
      FOR EACH ROW EXECUTE FUNCTION reject_corpus_fund_ledger_mutation();
  `);
  pgm.sql(`
    CREATE TRIGGER corpus_fund_ledger_no_delete
      BEFORE DELETE ON corpus_fund_ledger
      FOR EACH ROW EXECUTE FUNCTION reject_corpus_fund_ledger_mutation();
  `);

  // A second way to earn the SAME kind of token — buying something through
  // the platform, not just answering questions. No new token state, no
  // "actualising" old tokens; this just credits new ones (TOKEN_ECONOMY_REDESIGN.md).
  pgm.sql(`ALTER TABLE token_ledger DROP CONSTRAINT token_ledger_entry_check;`);
  pgm.sql(`
    ALTER TABLE token_ledger ADD CONSTRAINT token_ledger_entry_check
      CHECK (entry IN ('earn_response','earn_snap','earn_voice','earn_intent',
                        'earn_bonus','earn_purchase','redeem_offer','expire','adjustment'));
  `);
};

export const down = async (pgm) => {
  pgm.sql(`ALTER TABLE token_ledger DROP CONSTRAINT token_ledger_entry_check;`);
  pgm.sql(`
    ALTER TABLE token_ledger ADD CONSTRAINT token_ledger_entry_check
      CHECK (entry IN ('earn_response','earn_snap','earn_voice','earn_intent',
                        'earn_bonus','redeem_offer','expire','adjustment'));
  `);

  pgm.sql(`DROP TRIGGER IF EXISTS corpus_fund_ledger_no_delete ON corpus_fund_ledger;`);
  pgm.sql(`DROP TRIGGER IF EXISTS corpus_fund_ledger_no_update ON corpus_fund_ledger;`);
  pgm.sql(`DROP FUNCTION IF EXISTS reject_corpus_fund_ledger_mutation();`);
  pgm.dropTable("corpus_fund_ledger");

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
