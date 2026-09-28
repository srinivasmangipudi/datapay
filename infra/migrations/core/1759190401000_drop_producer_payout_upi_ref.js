export const shorthands = undefined;

// Counterpart to vault/1759190400000_payout_refs.js — the provider reference
// now lives in Vault. Core keeps `status`, which is the truth about whether
// money moved and is what ops actually reads; it keeps no handle into the
// provider's records.
//
// Safe as a plain drop: producer_payouts had zero rows when this was written
// (no real payout has ever run — UPI_PROVIDER is still DevSandboxUpiProvider),
// so there is nothing to migrate across. Doing it now rather than after the
// pilot is the whole point: once there is real payout history this becomes a
// data migration over money records.
export const up = (pgm) => {
  pgm.dropColumn("producer_payouts", "upi_ref");
};

export const down = (pgm) => {
  pgm.addColumn("producer_payouts", { upi_ref: { type: "text" } });
};
