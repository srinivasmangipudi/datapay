export const shorthands = undefined;

// The provider's transaction reference for an executed payout, moved here out
// of core.producer_payouts.
//
// The ref isn't PII on its face — it's an opaque receipt number. But it is a
// join key into the payment provider's records, which DO know the beneficiary
// bank account. SPEC.md LAW 1 claims "if Core leaks entirely, no human is
// identifiable"; a ref sitting next to an alias_id in Core weakened that to
// "…unless the reader also has provider access." Keeping it on this side puts
// every step of the alias → money → person chain behind the Vault boundary,
// which is the same shape payout_instruments and delivery_addresses already
// have.
//
// Keyed by core.producer_payouts.id, which is an opaque serial to Vault: no
// alias, no user_id, so this table can't be walked back to a person without
// Core. Reconciliation reads it in batch, the way resolvePayoutBatch does.
export const up = (pgm) => {
  pgm.createTable("payout_refs", {
    payout_id: { type: "integer", primaryKey: true },
    upi_ref: { type: "text" },
    status: { type: "text", notNull: true },
    recorded_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

export const down = (pgm) => {
  pgm.dropTable("payout_refs");
};
