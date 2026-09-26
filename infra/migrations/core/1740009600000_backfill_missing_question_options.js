export const shorthands = undefined;

// 1739318400000_seed_household_demo_questions.js only wrote question_options
// for intent_window questions and for rows that declared their own `options`.
// Its `yesno` entries declared none, so they were approved and served with an
// empty option list — the app renders that list and there is nothing to tap,
// so a member could neither answer nor skip. Eight of them reached production.
//
// Backfills the standard choices for any option-requiring question that has
// none. Kannada labels match the ones the seed already used elsewhere
// (ಹೌದು / ಬಹುಶಃ / ಇಲ್ಲ), so a member sees the same words either way.
const DEFAULTS = {
  yesno: [
    { en: "Yes", kn: "ಹೌದು" },
    { en: "No", kn: "ಇಲ್ಲ" },
  ],
  intent_window: [
    { en: "Yes", kn: "ಹೌದು" },
    { en: "Maybe", kn: "ಬಹುಶಃ" },
    { en: "No", kn: "ಇಲ್ಲ" },
  ],
};

export const up = async (pgm) => {
  for (const [type, options] of Object.entries(DEFAULTS)) {
    const { rows } = await pgm.db.query(
      `SELECT id FROM questions q
        WHERE q.type = $1
          AND NOT EXISTS (SELECT 1 FROM question_options o WHERE o.question_id = q.id)`,
      [type]
    );
    for (const { id } of rows) {
      for (const [i, opt] of options.entries()) {
        await pgm.db.query(
          `INSERT INTO question_options (question_id, label_en, label_kn, sort) VALUES ($1, $2, $3, $4)`,
          [id, opt.en, opt.kn, i + 1]
        );
      }
    }
  }
};

// Deliberately irreversible: down() would have to guess which options were
// backfilled here versus authored, and removing a real option would orphan
// the responses pointing at it.
export const down = () => {};
