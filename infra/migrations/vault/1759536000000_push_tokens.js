export const shorthands = undefined;

// Push tokens live in Vault, not Core, for the same reason phone numbers,
// delivery addresses and UPI IDs do: a push token is HOW TO REACH A PERSON.
//
// The split mirrors resolvePayoutBatch exactly — Core decides WHO should be
// nudged (only Core knows who has unanswered questions), then asks Vault to
// resolve those aliases to devices in one batch. Core therefore never holds a
// device identifier, so a full Core leak gives an attacker no ability to push
// a message to a single member's phone.
//
// Keyed by token, not by user: the same person may have several devices, and
// FCM reassigns a token to a different install, so the token is the identity
// and a re-register simply re-points it.
export const up = (pgm) => {
  pgm.createTable("push_tokens", {
    token: { type: "text", primaryKey: true },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    platform: { type: "text", notNull: true, check: "platform IN ('android','ios')" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    // Refreshed on every re-register. A token FCM rejects as unregistered is
    // deleted outright rather than aged out — see removePushToken.
    last_seen_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("push_tokens", "user_id");
};

export const down = (pgm) => {
  pgm.dropTable("push_tokens");
};
