export const shorthands = undefined;

// SPEC.md §39 — every question shows in English + Hindi + the viewer's
// local language, not just English + a hardcoded Kannada column. A single
// fixed text_kn column doesn't scale once zones can be anywhere in India
// (SPEC.md §38's geocoding fallback) — a Goa member's local language isn't
// Kannada. Real, unlimited-language storage replaces it.
export const up = (pgm) => {
  pgm.addColumn("zones", {
    // ISO-639-1-ish code (kn, hi, mr, ta, ...) — the zone's own local
    // language, used to pick which translation slot a member in that zone
    // sees. Nullable: an admin-created zone with no geocoded state data
    // doesn't get one guessed at it.
    language_code: { type: "text" },
  });

  pgm.createTable("question_translations", {
    question_id: { type: "integer", notNull: true, references: "questions", onDelete: "cascade" },
    language_code: { type: "text", notNull: true },
    text: { type: "text", notNull: true },
  });
  pgm.addConstraint("question_translations", "question_translations_pkey", {
    primaryKey: ["question_id", "language_code"],
  });

  // Every existing text_kn value becomes a real 'kn' row — no data lost.
  pgm.sql(`
    INSERT INTO question_translations (question_id, language_code, text)
    SELECT id, 'kn', text_kn FROM questions WHERE text_kn IS NOT NULL
  `);

  pgm.dropColumn("questions", "text_kn");

  // The pilot's own 5 zones are all real Karnataka locations.
  pgm.sql(`
    UPDATE zones SET language_code = 'kn'
    WHERE id IN (
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000005'
    )
  `);
};

export const down = (pgm) => {
  pgm.addColumn("questions", { text_kn: { type: "text" } });
  pgm.sql(`
    UPDATE questions q SET text_kn = qt.text
    FROM question_translations qt
    WHERE qt.question_id = q.id AND qt.language_code = 'kn'
  `);
  pgm.dropTable("question_translations");
  pgm.dropColumn("zones", "language_code");
};
