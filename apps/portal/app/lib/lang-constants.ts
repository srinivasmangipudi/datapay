// Client-safe half of the language toggle: just the type and cookie name, no
// next/headers import. Split out from language.ts because a "use client"
// component (LanguageSwitcher) needs LANG_COOKIE/Lang but must never pull in
// next/headers transitively — Next.js treats that as a hard build error.
export type Lang = "en" | "kn";
export const LANG_COOKIE = "datapay_lang";
