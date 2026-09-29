export const shorthands = undefined;

// A delivery agent's phone number.
//
// In Vault for the same reason every other phone number is: LAW 1 admits no
// phone into core_db at all, and no-phone-in-core.integration.spec.ts proves
// it on every run. It caught this table's first draft sitting in Core.
//
// Keyed by core.delivery_agents.id, which is an opaque uuid here — Vault can
// resolve a phone to an agent and back, but knows nothing about what an agent
// covers or delivers. Sign-in is the two halves meeting: Vault answers "whose
// number is this", Core answers "is that their passcode".
export const up = (pgm) => {
  pgm.createTable("delivery_agent_phones", {
    agent_id: { type: "uuid", primaryKey: true },
    // E.164, so "9876543210", "+919876543210" and "+91 98765 43210" cannot
    // become three accounts for one person.
    phone_e164: { type: "text", notNull: true, unique: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.sql(`GRANT SELECT, INSERT, UPDATE, DELETE ON delivery_agent_phones TO vault_app;`);
};

export const down = (pgm) => {
  pgm.dropTable("delivery_agent_phones");
};
