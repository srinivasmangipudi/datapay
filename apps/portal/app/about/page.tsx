import { DataPayLogo } from "../components/DataPayLogo";
import { PublicNav } from "../components/PublicNav";
import { getLang } from "../lib/language";

const CONTENT = {
  en: {
    tagline: "Your data is your asset",
    title: "About DataPay",
    ideaH2: "The idea",
    ideaP1:
      "Every day, households already generate the data that describes what a community actually needs — what they're buying, what they're running low on, what they'd pay for. That data has always been valuable to someone. Historically, it just hasn't been valuable to the household that generated it.",
    ideaP2:
      "DataPay changes who benefits. Households answer a few short questions a day and browse a real product catalog, earning tokens either way. Organizations get a direct, honest channel to that same community — never a household's identity, only an aggregated signal real enough to act on.",
    wontH2: "What we won't do",
    wont: [
      "Sell or share an individual household's answers, identity, or location.",
      "Publish a number before at least 50 households stand behind it.",
      "Let an organization see a member directly — fulfillment stays identity-blind.",
    ],
    wontLast: "Pretend a feature is finished when it isn't — see our",
    wontLastLink: "privacy policy",
    wontLastEnd: "for exactly what's built today and what's still honestly in progress.",
    whoH2: "Who it's for",
    whoP:
      "Household members who want a small, honest reward for information they're already generating — and organizations, brands, and local suppliers who want real demand signals instead of guesses, and a direct way to reach the community that produced them.",
    contactP1: "Questions?",
    contactP2: "— or see the",
    contactP3: "for what's already being published.",
    registryLink: "public demand registry",
  },
  kn: {
    tagline: "ನಿಮ್ಮ ಡೇಟಾ ನಿಮ್ಮ ಆಸ್ತಿ",
    title: "DataPay ಬಗ್ಗೆ",
    ideaH2: "ಆಲೋಚನೆ",
    ideaP1:
      "ಪ್ರತಿ ದಿನ, ಮನೆಗಳು ಈಗಾಗಲೇ ಒಂದು ಸಮುದಾಯಕ್ಕೆ ನಿಜವಾಗಿ ಏನು ಬೇಕು ಎಂಬುದನ್ನು ವಿವರಿಸುವ ಡೇಟಾವನ್ನು ಉತ್ಪಾದಿಸುತ್ತವೆ — ಅವರು ಏನು ಖರೀದಿಸುತ್ತಿದ್ದಾರೆ, ಏನು ಕಡಿಮೆಯಾಗುತ್ತಿದೆ, ಯಾವುದಕ್ಕೆ ಪಾವತಿಸುತ್ತಾರೆ. ಆ ಡೇಟಾ ಯಾವಾಗಲೂ ಯಾರಿಗಾದರೂ ಮೌಲ್ಯಯುತವಾಗಿತ್ತು. ಐತಿಹಾಸಿಕವಾಗಿ, ಅದನ್ನು ಉತ್ಪಾದಿಸಿದ ಮನೆಗೆ ಮಾತ್ರ ಅದು ಮೌಲ್ಯಯುತವಾಗಿರಲಿಲ್ಲ.",
    ideaP2:
      "DataPay ಯಾರು ಲಾಭ ಪಡೆಯುತ್ತಾರೆ ಎಂಬುದನ್ನು ಬದಲಾಯಿಸುತ್ತದೆ. ಮನೆಗಳು ದಿನಕ್ಕೆ ಕೆಲವು ಸಣ್ಣ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸುತ್ತವೆ ಮತ್ತು ನಿಜವಾದ ಉತ್ಪನ್ನ ಪಟ್ಟಿಯನ್ನು ಬ್ರೌಸ್ ಮಾಡುತ್ತವೆ, ಎರಡೂ ರೀತಿಯಲ್ಲಿ ಟೋಕನ್‌ಗಳನ್ನು ಗಳಿಸುತ್ತವೆ. ಸಂಸ್ಥೆಗಳಿಗೆ ಅದೇ ಸಮುದಾಯಕ್ಕೆ ನೇರ, ಪ್ರಾಮಾಣಿಕ ಮಾರ್ಗ ಸಿಗುತ್ತದೆ — ಎಂದಿಗೂ ಮನೆಯ ಗುರುತು ಅಲ್ಲ, ಕ್ರಮ ಕೈಗೊಳ್ಳಲು ಸಾಕಷ್ಟು ನಿಜವಾದ ಒಟ್ಟುಗೂಡಿಸಿದ ಸಂಕೇತ ಮಾತ್ರ.",
    wontH2: "ನಾವು ಮಾಡದಿರುವುದು",
    wont: [
      "ಒಂದು ಮನೆಯ ಉತ್ತರಗಳು, ಗುರುತು, ಅಥವಾ ಸ್ಥಳವನ್ನು ಮಾರಾಟ ಮಾಡುವುದು ಅಥವಾ ಹಂಚಿಕೊಳ್ಳುವುದು.",
      "ಕನಿಷ್ಠ 50 ಮನೆಗಳು ಬೆಂಬಲಿಸುವ ಮೊದಲು ಒಂದು ಸಂಖ್ಯೆಯನ್ನು ಪ್ರಕಟಿಸುವುದು.",
      "ಒಂದು ಸಂಸ್ಥೆಗೆ ಸದಸ್ಯನನ್ನು ನೇರವಾಗಿ ನೋಡಲು ಬಿಡುವುದು — ಪೂರೈಕೆ ಯಾವಾಗಲೂ ಗುರುತು-ಕುರುಡಾಗಿರುತ್ತದೆ.",
    ],
    wontLast: "ಒಂದು ವೈಶಿಷ್ಟ್ಯ ಮುಗಿದಿಲ್ಲದಿದ್ದಾಗ ಮುಗಿದಿದೆ ಎಂದು ನಟಿಸುವುದು — ಇಂದು ಏನು ನಿರ್ಮಿಸಲಾಗಿದೆ ಮತ್ತು ಇನ್ನೂ ಪ್ರಾಮಾಣಿಕವಾಗಿ ಪ್ರಗತಿಯಲ್ಲಿದೆ ಎಂಬುದನ್ನು ನಮ್ಮ",
    wontLastLink: "ಗೌಪ್ಯತಾ ನೀತಿ",
    wontLastEnd: "ಯಲ್ಲಿ ನೋಡಿ.",
    whoH2: "ಇದು ಯಾರಿಗಾಗಿ",
    whoP:
      "ಈಗಾಗಲೇ ಉತ್ಪಾದಿಸುತ್ತಿರುವ ಮಾಹಿತಿಗಾಗಿ ಸಣ್ಣ, ಪ್ರಾಮಾಣಿಕ ಬಹುಮಾನ ಬಯಸುವ ಮನೆಯ ಸದಸ್ಯರು — ಮತ್ತು ಊಹೆಗಳ ಬದಲು ನಿಜವಾದ ಬೇಡಿಕೆ ಸಂಕೇತಗಳನ್ನು ಬಯಸುವ ಸಂಸ್ಥೆಗಳು, ಬ್ರ್ಯಾಂಡ್‌ಗಳು, ಮತ್ತು ಸ್ಥಳೀಯ ಪೂರೈಕೆದಾರರು, ಮತ್ತು ಅವುಗಳನ್ನು ಉತ್ಪಾದಿಸಿದ ಸಮುದಾಯವನ್ನು ತಲುಪಲು ನೇರ ಮಾರ್ಗ.",
    contactP1: "ಪ್ರಶ್ನೆಗಳಿವೆಯೇ?",
    contactP2: "— ಅಥವಾ ಈಗಾಗಲೇ ಪ್ರಕಟವಾಗುತ್ತಿರುವುದನ್ನು ನೋಡಲು",
    contactP3: "ನೋಡಿ.",
    registryLink: "ಸಾರ್ವಜನಿಕ ಬೇಡಿಕೆ ನೋಂದಣಿ",
  },
} as const;

export const dynamic = "force-dynamic";

export default function AboutPage(): JSX.Element {
  const lang = getLang();
  const t = CONTENT[lang];

  return (
    <>
      <PublicNav lang={lang} />
      <main className="page">
        <section className="hero">
          <span className="logoLight">
            <DataPayLogo size={44} tagline={t.tagline} />
          </span>
          <span className="logoDark">
            <DataPayLogo size={44} dark tagline={t.tagline} />
          </span>
          <h1>{t.title}</h1>
        </section>

        <section className="section">
          <h2>{t.ideaH2}</h2>
          <p>{t.ideaP1}</p>
          <p>{t.ideaP2}</p>
        </section>

        <section className="section">
          <h2>{t.wontH2}</h2>
          <ul>
            {t.wont.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>
              {t.wontLast} <a href="/privacy">{t.wontLastLink}</a> {t.wontLastEnd}
            </li>
          </ul>
        </section>

        <section className="section">
          <h2>{t.whoH2}</h2>
          <p>{t.whoP}</p>
        </section>

        <section className="section">
          <p>
            {t.contactP1} <a href="mailto:srinivas@socratus.org">srinivas@socratus.org</a> {t.contactP2}{" "}
            <a href="/registry">{t.registryLink}</a> {t.contactP3}
          </p>
        </section>

        <style
          dangerouslySetInnerHTML={{
            __html: `
        .page { max-width: 720px; margin: 0 auto; padding: 56px 24px 96px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
        .hero { text-align: center; margin-bottom: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .hero h1 { font-size: 2rem; margin: 8px 0 0; letter-spacing: -0.02em; color: #101418; }
        .section { margin-bottom: 40px; }
        .section h2 { font-size: 1.2rem; margin: 0 0 12px; color: #101418; }
        .section p, .section li { color: #3a3934; font-size: 14.5px; line-height: 1.7; }
        .section ul { padding-left: 20px; margin: 0 0 12px; }
        .section li { margin-bottom: 8px; }
        .section a { color: #0E7A5C; font-weight: 600; }
        .logoDark { display: none; }
        @media (prefers-color-scheme: dark) {
          .hero h1, .section h2 { color: #F6F5F1; }
          .section p, .section li { color: #c3c2b7; }
          .section a { color: #12946F; }
          .logoLight { display: none; }
          .logoDark { display: inline-flex; }
        }
      `,
          }}
        />
      </main>
    </>
  );
}
