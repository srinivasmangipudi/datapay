export const shorthands = undefined;

// Demo-day seed: a broader spread of everyday household-product categories and
// questions, ready to answer the moment a member opens Pulse — no wizard
// clicks needed before a demo. §2: still no health/religion/caste/political
// categories, all 'standard'. Kannada text is a translations-table row per
// SPEC.md §39 (questions.text_kn was dropped by 1739059200000_multilingual_questions.js).
const CATEGORIES = [
  { slug: "flour", name: "Flour", name_kn: "ಹಿಟ್ಟು" },
  { slug: "pulses", name: "Pulses", name_kn: "ಬೇಳೆಕಾಳು" },
  { slug: "vegetables", name: "Vegetables", name_kn: "ತರಕಾರಿ" },
  { slug: "organic-produce", name: "Organic produce", name_kn: "ಸಾವಯವ ಉತ್ಪನ್ನ" },
  { slug: "dairy", name: "Dairy", name_kn: "ಹಾಲಿನ ಉತ್ಪನ್ನ" },
  { slug: "spices", name: "Spices", name_kn: "ಮಸಾಲೆ" },
  { slug: "tea-coffee", name: "Tea & coffee", name_kn: "ಚಹಾ ಮತ್ತು ಕಾಫಿ" },
];

// categorySlug refers to either a category seeded above OR one of the five
// pilot categories from 1737676804000_seed_pilot_questions.js (rice, sugar,
// cooking-oil, soap, toothpaste) — both are resolved the same way below.
const QUESTIONS = [
  // Flour
  {
    categorySlug: "flour",
    type: "single",
    textEn: "Which flour does your household use most?",
    textKn: "ನಿಮ್ಮ ಮನೆಯಲ್ಲಿ ಯಾವ ಹಿಟ್ಟನ್ನು ಹೆಚ್ಚು ಬಳಸುತ್ತೀರಿ?",
    rewardTokens: 1,
    options: [
      { en: "Wheat", kn: "ಗೋಧಿ" },
      { en: "Rice", kn: "ಅಕ್ಕಿ" },
      { en: "Ragi (finger millet)", kn: "ರಾಗಿ" },
      { en: "Jowar", kn: "ಜೋಳ" },
      { en: "Multi-grain", kn: "ಮಿಶ್ರ ಧಾನ್ಯ" },
    ],
  },
  {
    categorySlug: "flour",
    type: "single",
    textEn: "Where do you usually buy your flour?",
    textKn: "ನೀವು ಸಾಮಾನ್ಯವಾಗಿ ಹಿಟ್ಟನ್ನು ಎಲ್ಲಿ ಖರೀದಿಸುತ್ತೀರಿ?",
    rewardTokens: 1,
    options: [
      { en: "Local mill", kn: "ಸ್ಥಳೀಯ ಗಿರಣಿ" },
      { en: "Branded packet", kn: "ಬ್ರಾಂಡೆಡ್ ಪ್ಯಾಕೆಟ್" },
      { en: "Grow & grind at home", kn: "ಮನೆಯಲ್ಲಿ ಬೆಳೆದು ರುಬ್ಬುವುದು" },
      { en: "Kirana store", kn: "ಕಿರಾಣಿ ಅಂಗಡಿ" },
    ],
  },
  {
    categorySlug: "flour",
    type: "yesno",
    textEn: "Have you bought packaged atta (wheat flour) in the last month?",
    textKn: "ಕಳೆದ ತಿಂಗಳು ಪ್ಯಾಕೇಟ್ ಗೋಧಿ ಹಿಟ್ಟು ಖರೀದಿಸಿದ್ದೀರಾ?",
    rewardTokens: 1,
  },
  {
    categorySlug: "flour",
    type: "numeric",
    textEn: "About how many kilograms of flour does your household use in a month?",
    textKn: "ನಿಮ್ಮ ಮನೆ ತಿಂಗಳಿಗೆ ಎಷ್ಟು ಕೆ.ಜಿ ಹಿಟ್ಟು ಬಳಸುತ್ತದೆ?",
    rewardTokens: 2,
  },

  // Pulses
  {
    categorySlug: "pulses",
    type: "single",
    textEn: "Which pulse does your household cook most often?",
    textKn: "ನಿಮ್ಮ ಮನೆಯಲ್ಲಿ ಯಾವ ಬೇಳೆಯನ್ನು ಹೆಚ್ಚು ಬೇಯಿಸುತ್ತೀರಿ?",
    rewardTokens: 1,
    options: [
      { en: "Toor dal", kn: "ತೊಗರಿ ಬೇಳೆ" },
      { en: "Moong dal", kn: "ಹೆಸರು ಬೇಳೆ" },
      { en: "Urad dal", kn: "ಉದ್ದಿನ ಬೇಳೆ" },
      { en: "Chana dal", kn: "ಕಡಲೆ ಬೇಳೆ" },
      { en: "Masoor dal", kn: "ಮಸೂರ್ ಬೇಳೆ" },
    ],
  },
  {
    categorySlug: "pulses",
    type: "multi",
    textEn: "Which pulses do you keep stocked at home?",
    textKn: "ಮನೆಯಲ್ಲಿ ಯಾವ ಬೇಳೆಕಾಳುಗಳನ್ನು ಸಂಗ್ರಹಿಸಿಟ್ಟುಕೊಳ್ಳುತ್ತೀರಿ?",
    rewardTokens: 1,
    options: [
      { en: "Toor dal", kn: "ತೊಗರಿ ಬೇಳೆ" },
      { en: "Moong dal", kn: "ಹೆಸರು ಬೇಳೆ" },
      { en: "Urad dal", kn: "ಉದ್ದಿನ ಬೇಳೆ" },
      { en: "Chana dal", kn: "ಕಡಲೆ ಬೇಳೆ" },
      { en: "Rajma", kn: "ರಾಜ್ಮಾ" },
    ],
  },
  {
    categorySlug: "pulses",
    type: "yesno",
    textEn: "Has the price of pulses gone up for you in the last 3 months?",
    textKn: "ಕಳೆದ 3 ತಿಂಗಳಲ್ಲಿ ಬೇಳೆಕಾಳುಗಳ ಬೆಲೆ ಹೆಚ್ಚಾಗಿದೆಯೇ?",
    rewardTokens: 1,
  },
  {
    categorySlug: "pulses",
    type: "intent_window",
    textEn: "Are you planning to buy pulses in bulk soon?",
    textKn: "ಶೀಘ್ರದಲ್ಲಿ ಬೇಳೆಕಾಳುಗಳನ್ನು ಸಗಟಾಗಿ ಖರೀದಿಸುವ ಯೋಜನೆ ಇದೆಯೇ?",
    rewardTokens: 1,
    intentWindow: "1m",
  },

  // Vegetables
  {
    categorySlug: "vegetables",
    type: "single",
    textEn: "Where do you mainly buy vegetables?",
    textKn: "ನೀವು ಮುಖ್ಯವಾಗಿ ತರಕಾರಿಗಳನ್ನು ಎಲ್ಲಿ ಖರೀದಿಸುತ್ತೀರಿ?",
    rewardTokens: 1,
    options: [
      { en: "Local market / santhe", kn: "ಸಂತೆ" },
      { en: "Street vendor", kn: "ಬೀದಿ ವ್ಯಾಪಾರಿ" },
      { en: "Supermarket", kn: "ಸೂಪರ್ ಮಾರ್ಕೆಟ್" },
      { en: "Own farm / kitchen garden", kn: "ಸ್ವಂತ ತೋಟ" },
    ],
  },
  {
    categorySlug: "vegetables",
    type: "multi",
    textEn: "Which vegetables do you buy most every week?",
    textKn: "ಪ್ರತಿ ವಾರ ಯಾವ ತರಕಾರಿಗಳನ್ನು ಹೆಚ್ಚು ಖರೀದಿಸುತ್ತೀರಿ?",
    rewardTokens: 1,
    options: [
      { en: "Onion", kn: "ಈರುಳ್ಳಿ" },
      { en: "Tomato", kn: "ಟೊಮ್ಯಾಟೊ" },
      { en: "Potato", kn: "ಆಲೂಗಡ್ಡೆ" },
      { en: "Beans", kn: "ಬೀನ್ಸ್" },
      { en: "Leafy greens", kn: "ಸೊಪ್ಪು" },
      { en: "Brinjal", kn: "ಬದನೆಕಾಯಿ" },
    ],
  },
  {
    categorySlug: "vegetables",
    type: "numeric",
    textEn: "About how much do you spend on vegetables in a week (in rupees)?",
    textKn: "ವಾರಕ್ಕೆ ತರಕಾರಿಗಳಿಗೆ ಸುಮಾರು ಎಷ್ಟು ಖರ್ಚು ಮಾಡುತ್ತೀರಿ (ರೂಪಾಯಿಗಳಲ್ಲಿ)?",
    rewardTokens: 2,
  },
  {
    categorySlug: "vegetables",
    type: "yesno",
    textEn: "Do you grow any vegetables at home?",
    textKn: "ನೀವು ಮನೆಯಲ್ಲಿ ಯಾವುದಾದರೂ ತರಕಾರಿ ಬೆಳೆಯುತ್ತೀರಾ?",
    rewardTokens: 1,
  },

  // Organic produce
  {
    categorySlug: "organic-produce",
    type: "yesno",
    textEn: "Have you ever bought organic vegetables or grains?",
    textKn: "ನೀವು ಎಂದಾದರೂ ಸಾವಯವ ತರಕಾರಿ ಅಥವಾ ಧಾನ್ಯ ಖರೀದಿಸಿದ್ದೀರಾ?",
    rewardTokens: 1,
  },
  {
    categorySlug: "organic-produce",
    type: "single",
    textEn: "If organic produce cost the same as regular, would you switch?",
    textKn: "ಸಾವಯವ ಉತ್ಪನ್ನ ಸಾಮಾನ್ಯ ಬೆಲೆಗೇ ಸಿಕ್ಕರೆ, ನೀವು ಬದಲಾಯಿಸುತ್ತೀರಾ?",
    rewardTokens: 1,
    options: [
      { en: "Yes, definitely", kn: "ಖಂಡಿತ ಹೌದು" },
      { en: "Maybe", kn: "ಬಹುಶಃ" },
      { en: "No", kn: "ಇಲ್ಲ" },
    ],
  },
  {
    categorySlug: "organic-produce",
    type: "multi",
    textEn: "What matters most to you about \"organic\"?",
    textKn: "\"ಸಾವಯವ\" ಎಂದರೆ ನಿಮಗೆ ಮುಖ್ಯವಾಗಿ ಏನು?",
    rewardTokens: 1,
    options: [
      { en: "No pesticides", kn: "ಕೀಟನಾಶಕ ಇಲ್ಲ" },
      { en: "Better taste", kn: "ಉತ್ತಮ ರುಚಿ" },
      { en: "Supports local farmers", kn: "ಸ್ಥಳೀಯ ರೈತರಿಗೆ ಬೆಂಬಲ" },
      { en: "Health", kn: "ಆರೋಗ್ಯ" },
    ],
  },
  {
    categorySlug: "organic-produce",
    type: "intent_window",
    textEn: "Are you planning to buy organic produce in the coming months?",
    textKn: "ಮುಂದಿನ ತಿಂಗಳುಗಳಲ್ಲಿ ಸಾವಯವ ಉತ್ಪನ್ನ ಖರೀದಿಸುವ ಯೋಜನೆ ಇದೆಯೇ?",
    rewardTokens: 1,
    intentWindow: "3m",
  },

  // Dairy
  {
    categorySlug: "dairy",
    type: "single",
    textEn: "Where does your household get its milk from?",
    textKn: "ನಿಮ್ಮ ಮನೆಗೆ ಹಾಲು ಎಲ್ಲಿಂದ ಬರುತ್ತದೆ?",
    rewardTokens: 1,
    options: [
      { en: "Local dairy / cooperative", kn: "ಸ್ಥಳೀಯ ಡೈರಿ" },
      { en: "Own cattle", kn: "ಸ್ವಂತ ಹಸು" },
      { en: "Packaged brand", kn: "ಪ್ಯಾಕೇಟ್ ಹಾಲು" },
      { en: "Milkman", kn: "ಹಾಲಿನವ" },
    ],
  },
  {
    categorySlug: "dairy",
    type: "multi",
    textEn: "Which dairy products does your household buy regularly?",
    textKn: "ನಿಮ್ಮ ಮನೆಯಲ್ಲಿ ಯಾವ ಹಾಲಿನ ಉತ್ಪನ್ನಗಳನ್ನು ನಿಯಮಿತವಾಗಿ ಖರೀದಿಸುತ್ತೀರಿ?",
    rewardTokens: 1,
    options: [
      { en: "Milk", kn: "ಹಾಲು" },
      { en: "Curd", kn: "ಮೊಸರು" },
      { en: "Ghee", kn: "ತುಪ್ಪ" },
      { en: "Paneer", kn: "ಪನೀರ್" },
      { en: "Butter", kn: "ಬೆಣ್ಣೆ" },
    ],
  },
  {
    categorySlug: "dairy",
    type: "yesno",
    textEn: "Has your milk price increased in the last 6 months?",
    textKn: "ಕಳೆದ 6 ತಿಂಗಳಲ್ಲಿ ಹಾಲಿನ ಬೆಲೆ ಹೆಚ್ಚಾಗಿದೆಯೇ?",
    rewardTokens: 1,
  },

  // Spices
  {
    categorySlug: "spices",
    type: "multi",
    textEn: "Which spices does your household buy most often?",
    textKn: "ನಿಮ್ಮ ಮನೆಯಲ್ಲಿ ಯಾವ ಮಸಾಲೆ ಪದಾರ್ಥಗಳನ್ನು ಹೆಚ್ಚು ಖರೀದಿಸುತ್ತೀರಿ?",
    rewardTokens: 1,
    options: [
      { en: "Chili powder", kn: "ಮೆಣಸಿನ ಪುಡಿ" },
      { en: "Turmeric", kn: "ಅರಿಶಿನ" },
      { en: "Coriander", kn: "ಕೊತ್ತಂಬರಿ" },
      { en: "Cumin", kn: "ಜೀರಿಗೆ" },
      { en: "Garam masala", kn: "ಗರಂ ಮಸಾಲ" },
    ],
  },
  {
    categorySlug: "spices",
    type: "single",
    textEn: "Do you buy spices whole or ready-ground?",
    textKn: "ಮಸಾಲೆಗಳನ್ನು ಸಂಪೂರ್ಣವಾಗಿ ಅಥವಾ ಸಿದ್ಧ ಪುಡಿಯಾಗಿ ಖರೀದಿಸುತ್ತೀರಾ?",
    rewardTokens: 1,
    options: [
      { en: "Whole, grind at home", kn: "ಸಂಪೂರ್ಣ, ಮನೆಯಲ್ಲಿ ರುಬ್ಬುವುದು" },
      { en: "Ready-ground packets", kn: "ಸಿದ್ಧ ಪುಡಿ ಪ್ಯಾಕೆಟ್" },
      { en: "Both", kn: "ಎರಡೂ" },
    ],
  },
  {
    categorySlug: "spices",
    type: "yesno",
    textEn: "Do you make your own masala blends at home?",
    textKn: "ನೀವು ಮನೆಯಲ್ಲಿ ಸ್ವಂತ ಮಸಾಲೆ ಪುಡಿ ತಯಾರಿಸುತ್ತೀರಾ?",
    rewardTokens: 1,
  },

  // Tea & coffee
  {
    categorySlug: "tea-coffee",
    type: "single",
    textEn: "Which does your household drink more?",
    textKn: "ನಿಮ್ಮ ಮನೆಯಲ್ಲಿ ಯಾವುದನ್ನು ಹೆಚ್ಚು ಕುಡಿಯುತ್ತೀರಿ?",
    rewardTokens: 1,
    options: [
      { en: "Tea", kn: "ಚಹಾ" },
      { en: "Coffee", kn: "ಕಾಫಿ" },
      { en: "Both equally", kn: "ಎರಡೂ ಸಮಾನವಾಗಿ" },
      { en: "Neither", kn: "ಯಾವುದೂ ಇಲ್ಲ" },
    ],
  },
  {
    categorySlug: "tea-coffee",
    type: "numeric",
    textEn: "How many cups of tea/coffee does your household make in a day?",
    textKn: "ನಿಮ್ಮ ಮನೆಯಲ್ಲಿ ದಿನಕ್ಕೆ ಎಷ್ಟು ಕಪ್ ಚಹಾ/ಕಾಫಿ ಮಾಡುತ್ತೀರಿ?",
    rewardTokens: 2,
  },
  {
    categorySlug: "tea-coffee",
    type: "yesno",
    textEn: "Do you buy a specific branded tea/coffee powder?",
    textKn: "ನಿರ್ದಿಷ್ಟ ಬ್ರಾಂಡ್‌ನ ಚಹಾ/ಕಾಫಿ ಪುಡಿ ಖರೀದಿಸುತ್ತೀರಾ?",
    rewardTokens: 1,
  },

  // A few more on the original pilot categories, for variety of type/depth
  {
    categorySlug: "rice",
    type: "multi",
    textEn: "Which rice varieties has your household bought in the last 3 months?",
    textKn: "ಕಳೆದ 3 ತಿಂಗಳಲ್ಲಿ ಯಾವ ಅಕ್ಕಿ ವಿಧಗಳನ್ನು ಖರೀದಿಸಿದ್ದೀರಿ?",
    rewardTokens: 1,
    options: [
      { en: "Sona Masuri", kn: "ಸೋನಾ ಮಸೂರಿ" },
      { en: "Basmati", kn: "ಬಾಸ್ಮತಿ" },
      { en: "Ponni", kn: "ಪೊನ್ನಿ" },
      { en: "Boiled rice (ukda)", kn: "ಬೇಯಿಸಿದ ಅಕ್ಕಿ" },
    ],
  },
  {
    categorySlug: "soap",
    type: "single",
    textEn: "What matters most when choosing soap?",
    textKn: "ಸಾಬೂನು ಆಯ್ಕೆಮಾಡುವಾಗ ಏನು ಮುಖ್ಯ?",
    rewardTokens: 1,
    options: [
      { en: "Price", kn: "ಬೆಲೆ" },
      { en: "Fragrance", kn: "ಸುವಾಸನೆ" },
      { en: "Skin-friendly", kn: "ಚರ್ಮಕ್ಕೆ ಸೂಕ್ತ" },
      { en: "Brand trust", kn: "ಬ್ರಾಂಡ್ ನಂಬಿಕೆ" },
    ],
  },
  {
    categorySlug: "toothpaste",
    type: "yesno",
    textEn: "Has your household tried an ayurvedic/herbal toothpaste?",
    textKn: "ನಿಮ್ಮ ಮನೆಯವರು ಆಯುರ್ವೇದಿಕ್/ಗಿಡಮೂಲಿಕೆ ಟೂತ್ ಪೇಸ್ಟ್ ಪ್ರಯತ್ನಿಸಿದ್ದೀರಾ?",
    rewardTokens: 1,
  },
];

export const up = async (pgm) => {
  for (const c of CATEGORIES) {
    await pgm.db.query(
      `INSERT INTO categories (slug, name, name_kn, sensitivity) VALUES ($1, $2, $3, 'standard')`,
      [c.slug, c.name, c.name_kn]
    );
  }

  const { rows: categoryRows } = await pgm.db.query(`SELECT id, slug FROM categories`);
  const categoryIdBySlug = Object.fromEntries(categoryRows.map((r) => [r.slug, r.id]));

  for (const q of QUESTIONS) {
    const categoryId = categoryIdBySlug[q.categorySlug];
    if (!categoryId) throw new Error(`Unknown category slug in seed: ${q.categorySlug}`);

    const { rows: qRows } = await pgm.db.query(
      `INSERT INTO questions (category_id, type, text_en, reward_tokens, intent_window)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [categoryId, q.type, q.textEn, q.rewardTokens, q.type === "intent_window" ? q.intentWindow : null]
    );
    const questionId = qRows[0].id;

    await pgm.db.query(
      `INSERT INTO question_translations (question_id, language_code, text) VALUES ($1, 'kn', $2)`,
      [questionId, q.textKn]
    );

    if (q.type === "intent_window") {
      await pgm.db.query(
        `INSERT INTO question_options (question_id, label_en, label_kn, sort) VALUES
           ($1, 'Yes', 'ಹೌದು', 1),
           ($1, 'Maybe', 'ಬಹುಶಃ', 2),
           ($1, 'No', 'ಇಲ್ಲ', 3)`,
        [questionId]
      );
    } else if (q.options?.length) {
      for (const [i, opt] of q.options.entries()) {
        await pgm.db.query(
          `INSERT INTO question_options (question_id, label_en, label_kn, sort) VALUES ($1, $2, $3, $4)`,
          [questionId, opt.en, opt.kn, i + 1]
        );
      }
    }
  }
};

export const down = async (pgm) => {
  const { rows: categoryRows } = await pgm.db.query(
    `SELECT id FROM categories WHERE slug = ANY($1)`,
    [CATEGORIES.map((c) => c.slug)]
  );
  const newCategoryIds = categoryRows.map((r) => r.id);

  const questionTexts = QUESTIONS.map((q) => q.textEn);
  const { rows: questionRows } = await pgm.db.query(
    `SELECT id FROM questions WHERE text_en = ANY($1)`,
    [questionTexts]
  );
  const questionIds = questionRows.map((r) => r.id);

  if (questionIds.length) {
    await pgm.db.query(`DELETE FROM question_translations WHERE question_id = ANY($1)`, [questionIds]);
    await pgm.db.query(`DELETE FROM question_options WHERE question_id = ANY($1)`, [questionIds]);
    await pgm.db.query(`DELETE FROM questions WHERE id = ANY($1)`, [questionIds]);
  }
  if (newCategoryIds.length) {
    await pgm.db.query(`DELETE FROM categories WHERE id = ANY($1)`, [newCategoryIds]);
  }
};
