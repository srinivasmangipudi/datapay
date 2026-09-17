import { cookies } from "next/headers";
import { LANG_COOKIE, type Lang } from "./lang-constants";

export type { Lang };
export { LANG_COOKIE };

// Public-site language toggle — separate from SPEC.md §39's per-member
// resolved language (that's about a member's own zone; this is a plain
// visitor preference on marketing pages, a client-set cookie, English
// default). "kn" matches the code used everywhere else in this codebase
// (language-names.ts, the mobile app's own bilingual content).
export function getLang(): Lang {
  return cookies().get(LANG_COOKIE)?.value === "kn" ? "kn" : "en";
}
