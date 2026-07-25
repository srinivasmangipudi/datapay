/**
 * SPEC.md §39 — a real, if imperfect, mapping from an Indian state/UT to its
 * primary official/regional language, used to auto-set a geocoded zone's
 * `language_code`. A handful of states (Arunachal Pradesh, Meghalaya,
 * Nagaland) have no single dominant native language and use English
 * officially — mapped to "en" honestly, not forced into a wrong regional
 * pick. Ops can always correct a zone's language via the portal afterward.
 */
export const STATE_LANGUAGE: Record<string, string> = {
  "Andhra Pradesh": "te",
  "Arunachal Pradesh": "en",
  Assam: "as",
  Bihar: "hi",
  Chhattisgarh: "hi",
  Goa: "kok",
  Gujarat: "gu",
  Haryana: "hi",
  "Himachal Pradesh": "hi",
  Jharkhand: "hi",
  Karnataka: "kn",
  Kerala: "ml",
  "Madhya Pradesh": "hi",
  Maharashtra: "mr",
  Manipur: "mni",
  Meghalaya: "en",
  Mizoram: "en",
  Nagaland: "en",
  Odisha: "or",
  Punjab: "pa",
  Rajasthan: "hi",
  Sikkim: "ne",
  "Tamil Nadu": "ta",
  Telangana: "te",
  Tripura: "bn",
  "Uttar Pradesh": "hi",
  Uttarakhand: "hi",
  "West Bengal": "bn",
  // Union territories
  "Andaman and Nicobar Islands": "hi",
  Chandigarh: "hi",
  "Dadra and Nagar Haveli and Daman and Diu": "gu",
  Delhi: "hi",
  "Jammu and Kashmir": "ur",
  Ladakh: "en",
  Lakshadweep: "ml",
  Puducherry: "ta",
};

/** Display names for the translate UI — only languages this platform actually offers. */
export const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi",
  kn: "Kannada",
  mr: "Marathi",
  ta: "Tamil",
  te: "Telugu",
  ml: "Malayalam",
  bn: "Bengali",
  gu: "Gujarati",
  pa: "Punjabi",
  or: "Odia",
  as: "Assamese",
  ur: "Urdu",
  kok: "Konkani",
  ne: "Nepali",
  mni: "Manipuri",
};

/** Null if the state isn't in the map, or isn't a real state name at all — never a fabricated guess. */
export function languageForState(state: string | null): string | null {
  if (!state) return null;
  return STATE_LANGUAGE[state] ?? null;
}
