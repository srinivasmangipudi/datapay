export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable("users", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    phone_e164: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    kyc_state: { type: "text", notNull: true, default: "unverified" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("otp_codes", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "cascade" },
    code_hash: { type: "text", notNull: true },
    code_salt: { type: "text", notNull: true },
    expires_at: { type: "timestamptz", notNull: true },
    consumed_at: { type: "timestamptz" },
    attempt_count: { type: "integer", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("otp_codes", "user_id");

  // Write-once bridge (LAW 1): the only row anywhere linking a real person to a member.
  pgm.createTable("alias_map", {
    user_id: { type: "uuid", notNull: true, unique: true, references: "users", onDelete: "restrict" },
    alias_id: { type: "text", notNull: true, unique: true },
    display_alias: { type: "text", notNull: true, unique: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("vault_access_log", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    service: { type: "text", notNull: true },
    purpose: { type: "text", notNull: true },
    alias_or_token: { type: "text", notNull: true },
    at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

export const down = (pgm) => {
  pgm.dropTable("vault_access_log");
  pgm.dropTable("alias_map");
  pgm.dropTable("otp_codes");
  pgm.dropTable("users");
};
