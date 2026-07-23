export const shorthands = undefined;

// Melukote pilot seed (SPEC.md §1 / pitch deck ticker). §2: no health, religion,
// caste, precise-GPS, or political categories — ever. All five here are 'standard'.
const CATEGORIES = [
  { slug: "rice", name: "Rice", name_kn: "ಅಕ್ಕಿ" },
  { slug: "sugar", name: "Sugar", name_kn: "ಸಕ್ಕರೆ" },
  { slug: "cooking-oil", name: "Cooking oil", name_kn: "ಅಡುಗೆ ಎಣ್ಣೆ" },
  { slug: "soap", name: "Soap", name_kn: "ಸಾಬೂನು" },
  { slug: "toothpaste", name: "Toothpaste", name_kn: "ಟೂತ್ ಪೇಸ್ಟ್" },
];

export const up = async (pgm) => {
  for (const c of CATEGORIES) {
    await pgm.db.query(
      `INSERT INTO categories (slug, name, name_kn, sensitivity) VALUES ($1, $2, $3, 'standard')`,
      [c.slug, c.name, c.name_kn]
    );
  }

  const { rows: rice } = await pgm.db.query(`SELECT id FROM categories WHERE slug = 'rice'`);
  const { rows: sugar } = await pgm.db.query(`SELECT id FROM categories WHERE slug = 'sugar'`);
  const { rows: oil } = await pgm.db.query(`SELECT id FROM categories WHERE slug = 'cooking-oil'`);

  const { rows: q1 } = await pgm.db.query(
    `INSERT INTO questions (category_id, type, text_en, text_kn, reward_tokens)
     VALUES ($1, 'single', 'Which rice does your household buy?', 'ನಿಮ್ಮ ಮನೆಯಲ್ಲಿ ಯಾವ ಅಕ್ಕಿ ಬಳಸುತ್ತೀರಿ?', 4)
     RETURNING id`,
    [rice[0].id]
  );
  await pgm.db.query(
    `INSERT INTO question_options (question_id, label_en, label_kn, sort) VALUES
       ($1, 'Sona Masuri', 'ಸೋನಾ ಮಸೂರಿ', 1),
       ($1, 'Ponni', 'ಪೊನ್ನಿ', 2),
       ($1, 'Basmati', 'ಬಾಸ್ಮತಿ', 3),
       ($1, 'Broken/other', 'ಇತರೆ', 4)`,
    [q1[0].id]
  );

  const { rows: q2 } = await pgm.db.query(
    `INSERT INTO questions (category_id, type, text_en, text_kn, reward_tokens)
     VALUES ($1, 'intent_window', 'Do you plan to buy sugar in the next month?', 'ಮುಂದಿನ ತಿಂಗಳು ಸಕ್ಕರೆ ಖರೀದಿಸುವ ಯೋಜನೆ ಇದೆಯೇ?', 4)
     RETURNING id`,
    [sugar[0].id]
  );
  await pgm.db.query(
    `INSERT INTO question_options (question_id, label_en, label_kn, sort) VALUES
       ($1, 'Yes', 'ಹೌದು', 1),
       ($1, 'Maybe', 'ಬಹುಶಃ', 2),
       ($1, 'No', 'ಇಲ್ಲ', 3)`,
    [q2[0].id]
  );

  await pgm.db.query(
    `INSERT INTO questions (category_id, type, text_en, text_kn, reward_tokens)
     VALUES ($1, 'yesno', 'Do you currently use branded cooking oil?', 'ಪ್ರಸ್ತುತ ಬ್ರಾಂಡೆಡ್ ಅಡುಗೆ ಎಣ್ಣೆ ಬಳಸುತ್ತೀರಾ?', 3)`,
    [oil[0].id]
  );
};

export const down = async (pgm) => {
  await pgm.db.query(`DELETE FROM question_options`);
  await pgm.db.query(`DELETE FROM questions`);
  for (const c of CATEGORIES) {
    await pgm.db.query(`DELETE FROM categories WHERE slug = $1`, [c.slug]);
  }
};
