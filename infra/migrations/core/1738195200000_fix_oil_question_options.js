export const shorthands = undefined;

// Phase 2's seed migration (1737676804000_seed_pilot_questions.js) added
// question_options for the rice ('single') and sugar ('intent_window')
// questions but missed it entirely for the cooking-oil 'yesno' question —
// a plain oversight, not a deliberate "options come later" design. Left a
// member stuck mid-Pulse with a question and no way to answer it: zero
// options means zero tappable chips, so Confirm can never un-disable.
// A new migration, not editing the original — that migration has real
// response/token_ledger data hanging off it now via FK, so re-running its
// down() would be destructive.
export const up = async (pgm) => {
  const { rows } = await pgm.db.query(
    `SELECT id FROM questions WHERE text_en = 'Do you currently use branded cooking oil?'`
  );
  if (!rows[0]) throw new Error("Cooking oil question not found — seed migration may have changed");

  await pgm.db.query(
    `INSERT INTO question_options (question_id, label_en, label_kn, sort) VALUES
       ($1, 'Yes', 'ಹೌದು', 1),
       ($1, 'No', 'ಇಲ್ಲ', 2)`,
    [rows[0].id]
  );
};

export const down = async (pgm) => {
  await pgm.db.query(
    `DELETE FROM question_options WHERE question_id = (
       SELECT id FROM questions WHERE text_en = 'Do you currently use branded cooking oil?'
     )`
  );
};
