export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable("zones", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    parent_id: { type: "uuid", references: "zones", onDelete: "restrict" },
    level: {
      type: "text",
      notNull: true,
      check: "level IN ('constituency','hobli','panchayat','village')",
    },
    name: { type: "text", notNull: true },
    name_kn: { type: "text" },
  });
  pgm.createIndex("zones", "parent_id");

  // Members are pseudonymous by construction: alias_id is the primary key, never a phone or user_id.
  pgm.createTable("members", {
    alias_id: { type: "text", primaryKey: true },
    display_alias: { type: "text", notNull: true, unique: true },
    zone_id: { type: "uuid", notNull: true, references: "zones", onDelete: "restrict" },
    household_size_band: { type: "text" },
    locale: { type: "text", notNull: true, default: "kn" },
    joined_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    status: { type: "text", notNull: true, default: "active" },
    trust_score: { type: "numeric", notNull: true, default: 1.0 },
  });
  pgm.createIndex("members", "zone_id");

  // Pilot seed — Melukote constituency, per SPEC.md §1. Just enough for the zone picker to be real.
  pgm.sql(`
    INSERT INTO zones (id, parent_id, level, name, name_kn) VALUES
      ('00000000-0000-0000-0000-000000000001', NULL, 'constituency', 'Melukote', 'ಮೇಲುಕೋಟೆ'),
      ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'hobli', 'Melukote Hobli', 'ಮೇಲುಕೋಟೆ ಹೋಬಳಿ'),
      ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'hobli', 'Pandavapura Hobli', 'ಪಾಂಡವಪುರ ಹೋಬಳಿ'),
      ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'panchayat', 'Kikkeri', 'ಕಿಕ್ಕೇರಿ'),
      ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', 'village', 'Kikkeri Village', 'ಕಿಕ್ಕೇರಿ ಗ್ರಾಮ');
  `);
};

export const down = (pgm) => {
  pgm.dropTable("members");
  pgm.dropTable("zones");
};
