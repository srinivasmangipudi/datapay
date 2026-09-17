import { DataPayLogo } from "./components/DataPayLogo";
import { PublicNav } from "./components/PublicNav";
import type { Lang } from "./lib/language";
import { SystemDiagram } from "./SystemDiagram";

const ICONS = [
  <path
    key="1"
    d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
  <path
    key="2"
    d="M12 2l8 3.5v5c0 5-3.4 8.7-8 10.5-4.6-1.8-8-5.5-8-10.5v-5L12 2z"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
  <path
    key="3"
    d="M4 19V9M11 19V4M18 19v-7"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
  <path
    key="4"
    d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
];

// Kannada strings below are a first machine-assisted draft, same posture as
// apps/mobile/src/i18n/strings.ts's own header comment: a starting point,
// not a finished translation — worth a native-speaker review before being
// treated as final copy. The SVG system diagram's own internal labels stay
// English-only for now; translating fixed-width SVG text risks visual
// overflow that needs per-language layout verification this pass didn't do.
const CONTENT = {
  en: {
    tagline: "Your data is your asset",
    heroTitle: "Real household demand, direct from real households",
    heroLede:
      "DataPay turns a few daily questions from local households into honest, aggregated demand signals — and gives organizations a direct channel to that same community: run priced survey questions, or list your own products for households to browse and reserve.",
    ctaSignup: "Sign up your organization",
    ctaHowItWorks: "See how it works",
    howEyebrow: "How it works",
    howTitle: "From a household's answer to a real business decision",
    steps: [
      { title: "Answer & browse", text: "A few daily questions, a token reward for each — plus a real product catalog to browse and reserve." },
      { title: "Aggregated privately", text: "Every answer is tied to a private alias only — never a name or phone number an organization could see." },
      { title: "Real signals surface", text: "A number only ever publishes once at least 50 households stand behind it — never one household alone." },
      { title: "Organizations respond", text: "Ask priced questions, or list products directly — households browse and reserve, no middleman." },
    ],
    systemEyebrow: "The system",
    systemTitle: "Two flows, always — data up, value back down",
    systemLede: "Households never deal with organizations directly, and organizations never see a household directly. DataPay sits in between, on purpose.",
    orgsEyebrow: "For organizations",
    orgsTitle: "A direct channel to real local demand",
    cards: [
      { title: "Ask real households real questions", text: "Set your own token reward per question. Every submission is reviewed before it reaches anyone — never auto-published." },
      { title: "List your own products", text: "Point at a spreadsheet or add items by hand; households browse and reserve directly. Fulfillment happens outside the app — no in-app payment to set up." },
      { title: "See real demand, not guesses", text: "Aggregated signals only ever publish once at least 50 households stand behind a number — never one household's data alone." },
    ],
    protectionEyebrow: "Data protection",
    protectionTitle: "Privacy isn't a policy here — it's the architecture",
    protectionItems: [
      { title: "Private alias, always.", text: "Organizations only ever see an alias — never a name, phone number, or address." },
      { title: "Cohort floor of 50.", text: "No number publishes until at least 50 households stand behind it." },
      { title: "No raw location stored.", text: "Approximate area only, used to match the nearest zone — never exact coordinates." },
      { title: "You control sharing.", text: "Every category of data sharing can be turned off, any time, in the app." },
    ],
    protectionLink: "Read the full privacy policy →",
    aboutEyebrow: "About",
    aboutTitle: "Built for households first",
    aboutLede:
      "DataPay started from a simple idea: the data that already describes what a community needs is valuable, and the household generating it should be the one who benefits — in tokens, in better local availability, and in never being sold as a name and a phone number.",
    aboutLink: "More about DataPay →",
    finalTitle: "Ready to reach real local demand?",
    ctaRegistry: "See the public demand registry",
    footerLinks: {
      about: "About",
      privacy: "Privacy",
      delete: "Delete account",
      childSafety: "Child safety",
      registry: "Demand registry",
      orgLogin: "Organization login",
      contact: "Contact",
    },
  },
  kn: {
    tagline: "ನಿಮ್ಮ ಡೇಟಾ ನಿಮ್ಮ ಆಸ್ತಿ",
    heroTitle: "ನಿಜವಾದ ಮನೆಗಳ ನಿಜವಾದ ಬೇಡಿಕೆ, ನೇರವಾಗಿ ನಿಮಗೆ",
    heroLede:
      "DataPay ಸ್ಥಳೀಯ ಮನೆಗಳ ಕೆಲವು ದೈನಂದಿನ ಪ್ರಶ್ನೆಗಳನ್ನು ಪ್ರಾಮಾಣಿಕ, ಒಟ್ಟುಗೂಡಿಸಿದ ಬೇಡಿಕೆ ಸಂಕೇತಗಳಾಗಿ ಪರಿವರ್ತಿಸುತ್ತದೆ — ಮತ್ತು ಅದೇ ಸಮುದಾಯಕ್ಕೆ ಸಂಸ್ಥೆಗಳಿಗೆ ನೇರ ಮಾರ್ಗವನ್ನು ನೀಡುತ್ತದೆ: ಬೆಲೆ ನಿಗದಿತ ಸಮೀಕ್ಷೆ ಪ್ರಶ್ನೆಗಳನ್ನು ನಡೆಸಿ, ಅಥವಾ ಮನೆಗಳು ವೀಕ್ಷಿಸಲು ಮತ್ತು ಕಾಯ್ದಿರಿಸಲು ನಿಮ್ಮ ಸ್ವಂತ ಉತ್ಪನ್ನಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡಿ.",
    ctaSignup: "ನಿಮ್ಮ ಸಂಸ್ಥೆಯನ್ನು ಸೈನ್ ಅಪ್ ಮಾಡಿ",
    ctaHowItWorks: "ಇದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ ಎಂದು ನೋಡಿ",
    howEyebrow: "ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
    howTitle: "ಒಂದು ಮನೆಯ ಉತ್ತರದಿಂದ ನಿಜವಾದ ವ್ಯಾಪಾರ ನಿರ್ಧಾರದವರೆಗೆ",
    steps: [
      { title: "ಉತ್ತರಿಸಿ ಮತ್ತು ಬ್ರೌಸ್ ಮಾಡಿ", text: "ಕೆಲವು ದೈನಂದಿನ ಪ್ರಶ್ನೆಗಳು, ಪ್ರತಿಯೊಂದಕ್ಕೂ ಟೋಕನ್ ಬಹುಮಾನ — ಜೊತೆಗೆ ಬ್ರೌಸ್ ಮಾಡಲು ಮತ್ತು ಕಾಯ್ದಿರಿಸಲು ನಿಜವಾದ ಉತ್ಪನ್ನ ಪಟ್ಟಿ." },
      { title: "ಖಾಸಗಿಯಾಗಿ ಒಟ್ಟುಗೂಡಿಸಲಾಗಿದೆ", text: "ಪ್ರತಿ ಉತ್ತರವು ಖಾಸಗಿ ಅಲಿಯಾಸ್‌ಗೆ ಮಾತ್ರ ಸಂಬಂಧಿಸಿದೆ — ಸಂಸ್ಥೆಯು ನೋಡಬಹುದಾದ ಹೆಸರು ಅಥವಾ ಫೋನ್ ಸಂಖ್ಯೆ ಎಂದಿಗೂ ಅಲ್ಲ." },
      { title: "ನಿಜವಾದ ಸಂಕೇತಗಳು ಹೊರಹೊಮ್ಮುತ್ತವೆ", text: "ಕನಿಷ್ಠ 50 ಮನೆಗಳು ಬೆಂಬಲಿಸಿದ ನಂತರವೇ ಒಂದು ಸಂಖ್ಯೆ ಪ್ರಕಟವಾಗುತ್ತದೆ — ಎಂದಿಗೂ ಒಂದೇ ಮನೆ ಅಲ್ಲ." },
      { title: "ಸಂಸ್ಥೆಗಳು ಪ್ರತಿಕ್ರಿಯಿಸುತ್ತವೆ", text: "ಬೆಲೆ ನಿಗದಿತ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ, ಅಥವಾ ಉತ್ಪನ್ನಗಳನ್ನು ನೇರವಾಗಿ ಪಟ್ಟಿ ಮಾಡಿ — ಮನೆಗಳು ಬ್ರೌಸ್ ಮಾಡಿ ಕಾಯ್ದಿರಿಸುತ್ತವೆ, ಯಾವುದೇ ಮಧ್ಯವರ್ತಿ ಇಲ್ಲ." },
    ],
    systemEyebrow: "ವ್ಯವಸ್ಥೆ",
    systemTitle: "ಎರಡು ಹರಿವುಗಳು, ಯಾವಾಗಲೂ — ಡೇಟಾ ಮೇಲಕ್ಕೆ, ಮೌಲ್ಯ ಕೆಳಗೆ",
    systemLede: "ಮನೆಗಳು ಎಂದಿಗೂ ಸಂಸ್ಥೆಗಳೊಂದಿಗೆ ನೇರವಾಗಿ ವ್ಯವಹರಿಸುವುದಿಲ್ಲ, ಮತ್ತು ಸಂಸ್ಥೆಗಳು ಎಂದಿಗೂ ಮನೆಯನ್ನು ನೇರವಾಗಿ ನೋಡುವುದಿಲ್ಲ. DataPay ಉದ್ದೇಶಪೂರ್ವಕವಾಗಿ ನಡುವೆ ಇರುತ್ತದೆ.",
    orgsEyebrow: "ಸಂಸ್ಥೆಗಳಿಗಾಗಿ",
    orgsTitle: "ನಿಜವಾದ ಸ್ಥಳೀಯ ಬೇಡಿಕೆಗೆ ನೇರ ಮಾರ್ಗ",
    cards: [
      { title: "ನಿಜವಾದ ಮನೆಗಳಿಗೆ ನಿಜವಾದ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ", text: "ಪ್ರತಿ ಪ್ರಶ್ನೆಗೆ ನಿಮ್ಮ ಸ್ವಂತ ಟೋಕನ್ ಬಹುಮಾನವನ್ನು ನಿಗದಿಪಡಿಸಿ. ಪ್ರತಿ ಸಲ್ಲಿಕೆಯನ್ನು ಯಾರಿಗಾದರೂ ತಲುಪುವ ಮೊದಲು ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ — ಎಂದಿಗೂ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪ್ರಕಟವಾಗುವುದಿಲ್ಲ." },
      { title: "ನಿಮ್ಮ ಸ್ವಂತ ಉತ್ಪನ್ನಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡಿ", text: "ಸ್ಪ್ರೆಡ್‌ಶೀಟ್ ಲಿಂಕ್ ನೀಡಿ ಅಥವಾ ಕೈಯಿಂದ ಐಟಂಗಳನ್ನು ಸೇರಿಸಿ; ಮನೆಗಳು ನೇರವಾಗಿ ಬ್ರೌಸ್ ಮಾಡಿ ಕಾಯ್ದಿರಿಸುತ್ತವೆ. ಪೂರೈಕೆ ಅಪ್ಲಿಕೇಶನ್‌ನ ಹೊರಗೆ ನಡೆಯುತ್ತದೆ — ಅಪ್ಲಿಕೇಶನ್‌ನಲ್ಲಿ ಪಾವತಿ ಸೆಟಪ್ ಮಾಡುವ ಅಗತ್ಯವಿಲ್ಲ." },
      { title: "ಊಹೆಗಳಲ್ಲ, ನಿಜವಾದ ಬೇಡಿಕೆಯನ್ನು ನೋಡಿ", text: "ಒಟ್ಟುಗೂಡಿಸಿದ ಸಂಕೇತಗಳು ಕನಿಷ್ಠ 50 ಮನೆಗಳು ಒಂದು ಸಂಖ್ಯೆಯನ್ನು ಬೆಂಬಲಿಸಿದಾಗ ಮಾತ್ರ ಪ್ರಕಟವಾಗುತ್ತವೆ — ಎಂದಿಗೂ ಒಂದೇ ಮನೆಯ ಡೇಟಾ ಅಲ್ಲ." },
    ],
    protectionEyebrow: "ಡೇಟಾ ಸಂರಕ್ಷಣೆ",
    protectionTitle: "ಗೌಪ್ಯತೆ ಇಲ್ಲಿ ಕೇವಲ ನೀತಿಯಲ್ಲ — ಅದು ವಿನ್ಯಾಸವೇ ಆಗಿದೆ",
    protectionItems: [
      { title: "ಯಾವಾಗಲೂ ಖಾಸಗಿ ಅಲಿಯಾಸ್.", text: "ಸಂಸ್ಥೆಗಳು ಅಲಿಯಾಸ್ ಅನ್ನು ಮಾತ್ರ ನೋಡುತ್ತವೆ — ಹೆಸರು, ಫೋನ್ ಸಂಖ್ಯೆ ಅಥವಾ ವಿಳಾಸ ಎಂದಿಗೂ ಅಲ್ಲ." },
      { title: "50ರ ಕನಿಷ್ಠ ಗುಂಪು ಮಿತಿ.", text: "ಕನಿಷ್ಠ 50 ಮನೆಗಳು ಬೆಂಬಲಿಸುವವರೆಗೆ ಯಾವುದೇ ಸಂಖ್ಯೆ ಪ್ರಕಟವಾಗುವುದಿಲ್ಲ." },
      { title: "ನಿಖರ ಸ್ಥಳವನ್ನು ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ.", text: "ಅಂದಾಜು ಪ್ರದೇಶ ಮಾತ್ರ, ಹತ್ತಿರದ ವಲಯವನ್ನು ಹೊಂದಿಸಲು ಬಳಸಲಾಗುತ್ತದೆ — ನಿಖರ ನಿರ್ದೇಶಾಂಕಗಳು ಎಂದಿಗೂ ಅಲ್ಲ." },
      { title: "ಹಂಚಿಕೆಯನ್ನು ನೀವೇ ನಿಯಂತ್ರಿಸುತ್ತೀರಿ.", text: "ಡೇಟಾ ಹಂಚಿಕೆಯ ಪ್ರತಿಯೊಂದು ವರ್ಗವನ್ನು ಅಪ್ಲಿಕೇಶನ್‌ನಲ್ಲಿ ಯಾವುದೇ ಸಮಯದಲ್ಲಿ ಆಫ್ ಮಾಡಬಹುದು." },
    ],
    protectionLink: "ಸಂಪೂರ್ಣ ಗೌಪ್ಯತಾ ನೀತಿಯನ್ನು ಓದಿ →",
    aboutEyebrow: "ನಮ್ಮ ಬಗ್ಗೆ",
    aboutTitle: "ಮೊದಲು ಮನೆಗಳಿಗಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ",
    aboutLede:
      "DataPay ಒಂದು ಸರಳ ಆಲೋಚನೆಯಿಂದ ಪ್ರಾರಂಭವಾಯಿತು: ಒಂದು ಸಮುದಾಯಕ್ಕೆ ಏನು ಬೇಕು ಎಂಬುದನ್ನು ಈಗಾಗಲೇ ವಿವರಿಸುವ ಡೇಟಾ ಮೌಲ್ಯಯುತವಾಗಿದೆ, ಮತ್ತು ಅದನ್ನು ಉತ್ಪಾದಿಸುವ ಮನೆಯೇ ಅದರ ಲಾಭ ಪಡೆಯಬೇಕು — ಟೋಕನ್‌ಗಳಲ್ಲಿ, ಉತ್ತಮ ಸ್ಥಳೀಯ ಲಭ್ಯತೆಯಲ್ಲಿ, ಮತ್ತು ಹೆಸರು ಮತ್ತು ಫೋನ್ ಸಂಖ್ಯೆಯಾಗಿ ಎಂದಿಗೂ ಮಾರಾಟವಾಗದಿರುವುದರಲ್ಲಿ.",
    aboutLink: "DataPay ಬಗ್ಗೆ ಇನ್ನಷ್ಟು →",
    finalTitle: "ನಿಜವಾದ ಸ್ಥಳೀಯ ಬೇಡಿಕೆಯನ್ನು ತಲುಪಲು ಸಿದ್ಧರಿದ್ದೀರಾ?",
    ctaRegistry: "ಸಾರ್ವಜನಿಕ ಬೇಡಿಕೆ ನೋಂದಣಿಯನ್ನು ನೋಡಿ",
    footerLinks: {
      about: "ನಮ್ಮ ಬಗ್ಗೆ",
      privacy: "ಗೌಪ್ಯತೆ",
      delete: "ಖಾತೆ ಅಳಿಸಿ",
      childSafety: "ಮಕ್ಕಳ ಸುರಕ್ಷತೆ",
      registry: "ಬೇಡಿಕೆ ನೋಂದಣಿ",
      orgLogin: "ಸಂಸ್ಥೆ ಲಾಗಿನ್",
      contact: "ಸಂಪರ್ಕಿಸಿ",
    },
  },
} as const;

export function MarketingHome({ lang }: { lang: Lang }): JSX.Element {
  const t = CONTENT[lang];

  return (
    <>
      <PublicNav lang={lang} />
      <main className="mkPage">
        <section className="mkHero">
          <span className="mkLogoLight">
            <DataPayLogo size={52} tagline={t.tagline} />
          </span>
          <span className="mkLogoDark">
            <DataPayLogo size={52} dark tagline={t.tagline} />
          </span>
          <h1>{t.heroTitle}</h1>
          <p className="mkLede">{t.heroLede}</p>
          <div className="mkCtaRow">
            <a href="/org/signup" className="mkCtaPrimary">
              {t.ctaSignup}
            </a>
            <a href="#how-it-works" className="mkCtaSecondary">
              {t.ctaHowItWorks}
            </a>
          </div>
        </section>

        <section id="how-it-works" className="mkSection">
          <p className="mkEyebrow">{t.howEyebrow}</p>
          <h2>{t.howTitle}</h2>
          <div className="mkSteps">
            {t.steps.map((s, i) => (
              <div className="mkStep" key={s.title}>
                <span className="mkStepNum">{i + 1}</span>
                <svg className="mkStepIcon" viewBox="0 0 24 24" width="26" height="26">
                  {ICONS[i]}
                </svg>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mkSection mkSectionDiagram">
          <p className="mkEyebrow">{t.systemEyebrow}</p>
          <h2>{t.systemTitle}</h2>
          <p className="mkSectionLede">{t.systemLede}</p>
          <div className="mkDiagramWrap">
            <SystemDiagram />
          </div>
        </section>

        <section id="for-organizations" className="mkSection">
          <p className="mkEyebrow">{t.orgsEyebrow}</p>
          <h2>{t.orgsTitle}</h2>
          <div className="mkCards">
            {t.cards.map((c) => (
              <div className="mkCard" key={c.title}>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
          <a href="/org/signup" className="mkCtaPrimary mkCtaInline">
            {t.ctaSignup}
          </a>
        </section>

        <section className="mkSection mkSectionProtection">
          <p className="mkEyebrow">{t.protectionEyebrow}</p>
          <h2>{t.protectionTitle}</h2>
          <div className="mkProtectionGrid">
            {t.protectionItems.map((p) => (
              <div className="mkProtectionItem" key={p.title}>
                <strong>{p.title}</strong>
                <span>{p.text}</span>
              </div>
            ))}
          </div>
          <p className="mkProtectionLink">
            <a href="/privacy">{t.protectionLink}</a>
          </p>
        </section>

        <section className="mkSection mkSectionAbout">
          <p className="mkEyebrow">{t.aboutEyebrow}</p>
          <h2>{t.aboutTitle}</h2>
          <p className="mkSectionLede">
            {t.aboutLede} <a href="/about">{t.aboutLink}</a>
          </p>
        </section>

        <section className="mkSection mkSectionFinalCta">
          <h2>{t.finalTitle}</h2>
          <div className="mkCtaRow">
            <a href="/org/signup" className="mkCtaPrimary">
              {t.ctaSignup}
            </a>
            <a href="/registry" className="mkCtaSecondary">
              {t.ctaRegistry}
            </a>
          </div>
        </section>

        <footer className="mkFooter">
          <div className="mkFooterBrand">
            <span className="mkLogoLight">
              <DataPayLogo size={28} tagline={t.tagline} />
            </span>
            <span className="mkLogoDark">
              <DataPayLogo size={28} dark tagline={t.tagline} />
            </span>
          </div>
          <div className="mkFooterLinks">
            <a href="/about">{t.footerLinks.about}</a>
            <a href="/privacy">{t.footerLinks.privacy}</a>
            <a href="/delete-account">{t.footerLinks.delete}</a>
            <a href="/child-safety">{t.footerLinks.childSafety}</a>
            <a href="/registry">{t.footerLinks.registry}</a>
            <a href="/org/login">{t.footerLinks.orgLogin}</a>
            <a href="mailto:srinivas@socratus.org">{t.footerLinks.contact}</a>
          </div>
        </footer>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .mkPage { --mk-bg: #F6F5F1; --mk-surface: #fff; --mk-border: #E7E4DC; --mk-ink: #101418; --mk-subtle: #5B6672; --mk-mist: #8A939B; --mk-jade: #0E7A5C; --mk-jade-deep: #0B6249; --mk-jade-tint: #E3EFEA; --mk-brass: #B98F2F;
          background: var(--mk-bg); color: var(--mk-ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        }
        .mkHero { max-width: 720px; margin: 0 auto; padding: 72px 24px 56px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 20px; }
        .mkHero h1 { font-size: 2.4rem; line-height: 1.2; margin: 0; letter-spacing: -0.02em; }
        .mkLede { font-size: 16.5px; line-height: 1.7; color: var(--mk-subtle); max-width: 580px; margin: 0; }
        .mkCtaRow { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
        .mkCtaPrimary { background: var(--mk-jade); color: #fff; padding: 13px 24px; border-radius: 999px; font-weight: 700; font-size: 14.5px; text-decoration: none; }
        .mkCtaPrimary:hover { background: var(--mk-jade-deep); }
        .mkCtaSecondary { border: 1px solid var(--mk-border); color: var(--mk-ink); padding: 13px 24px; border-radius: 999px; font-weight: 600; font-size: 14.5px; text-decoration: none; }
        .mkCtaInline { display: inline-block; margin-top: 8px; }

        .mkSection { max-width: 980px; margin: 0 auto; padding: 56px 24px; border-top: 1px solid var(--mk-border); }
        .mkEyebrow { text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; font-weight: 700; color: var(--mk-jade); margin: 0 0 10px; }
        .mkSection h2 { font-size: 1.6rem; margin: 0 0 14px; letter-spacing: -0.01em; max-width: 640px; }
        .mkSectionLede { color: var(--mk-subtle); font-size: 15px; line-height: 1.7; max-width: 640px; margin: 0 0 8px; }
        .mkSectionLede a { color: var(--mk-jade); font-weight: 600; }

        .mkSteps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 32px; }
        .mkStep { position: relative; background: var(--mk-surface); border: 1px solid var(--mk-border); border-radius: 16px; padding: 24px 18px; }
        .mkStepNum { position: absolute; top: 16px; right: 18px; font-size: 12px; font-weight: 700; color: var(--mk-mist); }
        .mkStepIcon { color: var(--mk-jade); margin-bottom: 12px; }
        .mkStep h3 { font-size: 15px; margin: 0 0 8px; }
        .mkStep p { font-size: 13.5px; line-height: 1.6; color: var(--mk-subtle); margin: 0; }

        .mkDiagramWrap { margin-top: 28px; background: var(--mk-surface); border: 1px solid var(--mk-border); border-radius: 20px; padding: 28px 20px; overflow-x: auto; }

        .mkCards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 28px; }
        .mkCard { background: var(--mk-surface); border: 1px solid var(--mk-border); border-radius: 16px; padding: 24px; }
        .mkCard h3 { font-size: 15.5px; margin: 0 0 10px; }
        .mkCard p { font-size: 13.5px; line-height: 1.65; color: var(--mk-subtle); margin: 0; }

        .mkSectionProtection { background: var(--mk-jade-tint); border-radius: 24px; border-top: none; margin: 24px; padding: 48px 32px; max-width: none; }
        .mkProtectionGrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px 32px; margin-top: 24px; max-width: 720px; }
        .mkProtectionItem { display: flex; flex-direction: column; gap: 4px; }
        .mkProtectionItem strong { font-size: 14.5px; color: var(--mk-ink); }
        .mkProtectionItem span { font-size: 13.5px; color: var(--mk-subtle); line-height: 1.6; }
        .mkProtectionLink { margin-top: 24px; }
        .mkProtectionLink a { color: var(--mk-jade-deep); font-weight: 700; font-size: 14px; text-decoration: none; }

        .mkSectionFinalCta { text-align: center; }
        .mkSectionFinalCta h2 { margin: 0 auto 22px; }

        .mkFooter { max-width: 980px; margin: 0 auto; padding: 40px 24px 64px; border-top: 1px solid var(--mk-border); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; }
        .mkFooterLinks { display: flex; flex-wrap: wrap; gap: 20px; }
        .mkFooterLinks a { color: var(--mk-mist); text-decoration: none; font-size: 13px; font-weight: 600; }
        .mkFooterLinks a:hover { color: var(--mk-ink); }

        @media (max-width: 820px) {
          .mkSteps { grid-template-columns: repeat(2, 1fr); }
          .mkCards { grid-template-columns: 1fr; }
          .mkProtectionGrid { grid-template-columns: 1fr; }
        }
        @media (max-width: 520px) {
          .mkSteps { grid-template-columns: 1fr; }
          .mkHero h1 { font-size: 1.9rem; }
        }

        /* DataPayLogo's text colors are set via inline style (ink/brass
           picked by its own "dark" prop, not CSS) — inline styles always
           beat stylesheet rules, so a page-level dark-mode media query can't
           override them after the fact. Rendering both variants and
           toggling which is visible is the only reliable fix without
           changing the shared component. */
        .mkLogoDark { display: none; }
        @media (prefers-color-scheme: dark) {
          .mkPage { --mk-bg: #101418; --mk-surface: #14161b; --mk-border: #24282e; --mk-ink: #F6F5F1; --mk-subtle: #c3c2b7; --mk-mist: #9b9a94; --mk-jade: #12946F; --mk-jade-deep: #0E7A5C; --mk-jade-tint: #14211c; --mk-brass: #D4AA45; }
          .mkLogoLight { display: none; }
          .mkLogoDark { display: inline-flex; }
        }
      `,
        }}
      />
    </>
  );
}
