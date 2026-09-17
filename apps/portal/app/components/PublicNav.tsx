"use client";

import { useEffect, useState } from "react";
import type { Lang } from "../lib/lang-constants";
import { DataPayMark } from "./DataPayLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";

const T = {
  en: { how: "How it works", forOrgs: "For organizations", about: "About", privacy: "Privacy", login: "Log in", signup: "Sign up" },
  kn: { how: "ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ", forOrgs: "ಸಂಸ್ಥೆಗಳಿಗಾಗಿ", about: "ನಮ್ಮ ಬಗ್ಗೆ", privacy: "ಗೌಪ್ಯತೆ", login: "ಲಾಗಿನ್", signup: "ಸೈನ್ ಅಪ್" },
} as const;

// Shared across every public marketing page (home, about, privacy, ...) — a
// real navbar with proper CTAs and a language switcher, unlike the ops-only
// AdminNav this deliberately doesn't reuse (different audience, different
// links, no shared-password gate).
export function PublicNav({ lang }: { lang: Lang }): JSX.Element {
  const [scrolled, setScrolled] = useState(false);
  const t = T[lang];

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <nav className={`publicNav ${scrolled ? "publicNavScrolled" : ""}`}>
        <a href="/" className="publicNavBrand">
          <DataPayMark size={26} />
          <span>DataPay</span>
        </a>
        <div className="publicNavLinks">
          <a href="/#how-it-works">{t.how}</a>
          <a href="/#for-organizations">{t.forOrgs}</a>
          <a href="/about">{t.about}</a>
          <a href="/privacy">{t.privacy}</a>
        </div>
        <div className="publicNavActions">
          <LanguageSwitcher lang={lang} />
          <a href="/org/login" className="publicNavGhost">
            {t.login}
          </a>
          <a href="/org/signup" className="publicNavCta">
            {t.signup}
          </a>
        </div>
      </nav>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .publicNav {
          position: sticky; top: 0; z-index: 50;
          display: flex; align-items: center; gap: 32px;
          padding: 16px 32px;
          background: color-mix(in srgb, var(--pn-bg, #F6F5F1) 88%, transparent);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .publicNavScrolled { border-bottom-color: var(--pn-border, #E7E4DC); box-shadow: 0 1px 0 rgba(0,0,0,0.02); }
        .publicNavBrand { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--pn-ink, #101418); font-family: -apple-system, "Segoe UI", sans-serif; font-weight: 800; font-size: 17px; letter-spacing: -0.01em; }
        .publicNavLinks { display: flex; align-items: center; gap: 26px; flex: 1; }
        .publicNavLinks a { color: var(--pn-subtle, #5B6672); text-decoration: none; font-size: 14px; font-weight: 600; }
        .publicNavLinks a:hover { color: var(--pn-ink, #101418); }
        .publicNavActions { display: flex; align-items: center; gap: 10px; }
        .publicNavGhost { color: var(--pn-ink, #101418); text-decoration: none; font-size: 14px; font-weight: 600; padding: 9px 14px; }
        .publicNavCta { background: #0E7A5C; color: #fff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 10px 20px; border-radius: 999px; white-space: nowrap; }
        .publicNavCta:hover { background: #0B6249; }
        @media (max-width: 780px) {
          .publicNav { padding: 14px 18px; gap: 10px; }
          .publicNavLinks { display: none; }
          .publicNavGhost { display: none; }
        }
        @media (prefers-color-scheme: dark) {
          .publicNav { --pn-bg: #101418; --pn-border: #24282e; --pn-ink: #F6F5F1; --pn-subtle: #9b9a94; }
        }
      `,
        }}
      />
    </>
  );
}
