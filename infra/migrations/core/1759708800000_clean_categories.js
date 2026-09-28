export const shorthands = undefined;

// Adds the missing Kannada names. consents.service.ts lists categories to
// members, so anything without a name_kn showed a Kannada-locale member a raw
// English label among translated ones — and several English names read like
// scratch notes ("livelihood", "everyday spends") beside properly-cased
// siblings.
//
// NOT deleting the "social tensions" / "Social tensions based on religion"
// categories, on an explicit product decision: the pilot is meant to surface
// them for team feedback first. Both still carry only DRAFT questions and have
// zero responses, so nothing is being collected today — approving one is the
// point of no return, and see SPEC.md §11 before doing it.
const TRANSLATIONS = [
  { from: "Petrol", en: "Petrol", kn: "ಪೆಟ್ರೋಲ್" },
  { from: "livelihood", en: "Livelihood", kn: "ಜೀವನೋಪಾಯ" },
  { from: "social tensions", en: "Social tensions", kn: "ಸಾಮಾಜಿಕ ಉದ್ವಿಗ್ನತೆಗಳು" },
  {
    from: "Social tensions based on religion",
    en: "Social tensions based on religion",
    kn: "ಧರ್ಮದ ಆಧಾರದ ಮೇಲಿನ ಸಾಮಾಜಿಕ ಉದ್ವಿಗ್ನತೆಗಳು",
  },
  { from: "AI Fears", en: "AI concerns", kn: "ಎಐ ಬಗ್ಗೆ ಆತಂಕಗಳು" },
  { from: "Gas Prices", en: "Gas prices", kn: "ಅನಿಲ ಬೆಲೆಗಳು" },
  { from: "everyday spends", en: "Everyday spends", kn: "ದೈನಂದಿನ ಖರ್ಚುಗಳು" },
];

export const up = async (pgm) => {
  for (const t of TRANSLATIONS) {
    await pgm.db.query(`UPDATE categories SET name = $1, name_kn = $2 WHERE name = $3`, [
      t.en,
      t.kn,
      t.from,
    ]);
  }
};

// Not worth un-applying — a rollback that restored "everyday spends" and blank
// Kannada names would only put members back in front of untranslated labels.
export const down = () => {};
