"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "../lib/lang-constants";

// A plain document.cookie set (no round-trip needed — this is a visitor
// preference, not a session credential) followed by router.refresh() so
// every server component on the page re-reads it and re-renders in place.
export function LanguageSwitcher({ lang }: { lang: Lang }): JSX.Element {
  const router = useRouter();

  function setLang(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div className="langSwitcher" role="group" aria-label="Language">
      <button
        type="button"
        className={lang === "en" ? "langBtn langBtnOn" : "langBtn"}
        onClick={() => setLang("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={lang === "kn" ? "langBtn langBtnOn" : "langBtn"}
        onClick={() => setLang("kn")}
      >
        ಕನ್ನಡ
      </button>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .langSwitcher { display: flex; align-items: center; gap: 2px; background: var(--ls-bg, #EFEDE6); border-radius: 999px; padding: 3px; }
        .langBtn { border: none; background: transparent; color: var(--ls-subtle, #5B6672); font-size: 12.5px; font-weight: 700; padding: 6px 11px; border-radius: 999px; cursor: pointer; font-family: inherit; }
        .langBtnOn { background: var(--ls-surface, #fff); color: var(--ls-ink, #101418); }
        @media (prefers-color-scheme: dark) {
          .langSwitcher { --ls-bg: #1a1d22; --ls-subtle: #9b9a94; --ls-surface: #24282e; --ls-ink: #F6F5F1; }
        }
      `,
        }}
      />
    </div>
  );
}
