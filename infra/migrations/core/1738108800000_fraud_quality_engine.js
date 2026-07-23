export const shorthands = undefined;

export const up = (pgm) => {
  // SPEC.md §6 "Fraud/quality engine" + §5's target schema (quality_flags is
  // named there already, never migrated until now).
  pgm.createTable("quality_flags", {
    id: { type: "serial", primaryKey: true },
    alias_id: { type: "text", notNull: true, references: "members", onDelete: "cascade" },
    rule: {
      type: "text",
      notNull: true,
      check: "rule IN ('velocity_cap','intent_contradiction','device_dedup')",
    },
    detail: { type: "text", notNull: true },
    at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("quality_flags", ["alias_id", "at"]);

  // Hashed core-side, never linked to a phone number (LAW 1 holds even here)
  // — the mobile client sends a raw fingerprint, Core stores only its hash.
  // Multiple aliases sharing one fingerprint_hash is the dedup signal itself,
  // so (alias_id, fingerprint_hash) is unique but fingerprint_hash alone isn't.
  pgm.createTable("device_fingerprints", {
    id: { type: "serial", primaryKey: true },
    alias_id: { type: "text", notNull: true, references: "members", onDelete: "cascade" },
    fingerprint_hash: { type: "text", notNull: true },
    first_seen_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    last_seen_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("device_fingerprints", "device_fingerprints_alias_hash_unique", {
    unique: ["alias_id", "fingerprint_hash"],
  });
  pgm.createIndex("device_fingerprints", "fingerprint_hash");

  // SPEC.md §5's target schema also names audit_log; append-only by the same
  // discipline §15/§17 apply to the money ledgers — what admin/system actions
  // ran must be exactly as tamper-evident as the ledgers it accounts for.
  pgm.createTable("audit_log", {
    id: { type: "serial", primaryKey: true },
    actor_type: { type: "text", notNull: true, check: "actor_type IN ('admin','system')" },
    actor_id: { type: "text" },
    action: { type: "text", notNull: true },
    object: { type: "text", notNull: true },
    at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("audit_log", "at");

  pgm.sql(`
    CREATE OR REPLACE FUNCTION reject_audit_log_mutation() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'audit_log is append-only';
    END;
    $$ LANGUAGE plpgsql;
  `);
  pgm.sql(`
    CREATE TRIGGER audit_log_no_mutation
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();
  `);

  // Payout batching: every producer_payouts row inserted by the same
  // runPayouts() call shares a batch_id — groups a run for audit export
  // without a separate batches table nothing else needs.
  pgm.addColumn("producer_payouts", {
    batch_id: { type: "uuid" },
  });
  pgm.createIndex("producer_payouts", "batch_id");

  // Trust-weighted eligibility (§6): a low-trust producer's payout is held
  // for human review, never silently paid AND never silently confiscated.
  pgm.sql(`ALTER TABLE producer_payouts DROP CONSTRAINT producer_payouts_status_check`);
  pgm.addConstraint("producer_payouts", "producer_payouts_status_check", {
    check: "status IN ('pending','processing','paid','failed','review')",
  });
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE producer_payouts DROP CONSTRAINT producer_payouts_status_check`);
  pgm.addConstraint("producer_payouts", "producer_payouts_status_check", {
    check: "status IN ('pending','processing','paid','failed')",
  });
  pgm.dropColumn("producer_payouts", "batch_id");
  pgm.dropTable("audit_log");
  pgm.dropTable("device_fingerprints");
  pgm.dropTable("quality_flags");
};
