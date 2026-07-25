export const shorthands = undefined;

// Splits alias generation from alias commitment (SPEC.md §36): verify-otp now
// offers a first-time signer several display_alias CANDIDATES instead of
// silently assigning one. Nothing is reserved in alias_map until the member
// actually picks — this table is the short-lived bridge between "OTP
// verified" and "name chosen." One row per user (re-verifying replaces it,
// invalidating any earlier pending token), auto-expired by created_at at
// read time rather than a cleanup job — pilot scale doesn't need one yet.
export const up = (pgm) => {
  pgm.createTable("pending_signups", {
    token: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, unique: true, references: "users", onDelete: "cascade" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

export const down = (pgm) => {
  pgm.dropTable("pending_signups");
};
