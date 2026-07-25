// Display labels only (SPEC.md §39) — the authoritative code→name mapping
// used for the actual translate/state-derivation logic lives server-side
// (apps/api/src/zones/india-languages.util.ts).
export const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi", kn: "Kannada", mr: "Marathi", ta: "Tamil", te: "Telugu",
  ml: "Malayalam", bn: "Bengali", gu: "Gujarati", pa: "Punjabi", or: "Odia",
  as: "Assamese", ur: "Urdu", kok: "Konkani", ne: "Nepali", mni: "Manipuri",
};
