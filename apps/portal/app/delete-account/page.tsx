import { DataPayLogo } from "../components/DataPayLogo";
import { PublicNav } from "../components/PublicNav";
import { getLang } from "../lib/language";

export const dynamic = "force-dynamic";

const NOTICE = {
  en: null,
  kn: "ಈ ಕಾನೂನು ಪಠ್ಯದ ಕನ್ನಡ ಅನುವಾದವನ್ನು ನಾವು ಇನ್ನೂ ಪರಿಶೀಲಿಸಿಲ್ಲ, ಆದ್ದರಿಂದ ತಪ್ಪುಗಳನ್ನು ತಪ್ಪಿಸಲು ಕೆಳಗಿನ ಪಠ್ಯವನ್ನು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ತೋರಿಸಲಾಗಿದೆ.",
} as const;

export default function DeleteAccountPage(): JSX.Element {
  const lang = getLang();

  return (
    <>
      <PublicNav lang={lang} />
      <main className="page">
        <section className="hero">
          <span className="logoLight">
            <DataPayLogo size={44} tagline="Your data is your asset" />
          </span>
          <span className="logoDark">
            <DataPayLogo size={44} dark tagline="Your data is your asset" />
          </span>
          <h1>Delete your account</h1>
          {NOTICE[lang] && <p className="notice">{NOTICE[lang]}</p>}
        </section>

        <section className="section">
          <h2>How to request deletion</h2>
          <p>
            Email <a href="mailto:srinivas@socratus.org">srinivas@socratus.org</a> from the account
            you'd like closed, with the phone number registered on it. We'll confirm your identity
            and delete your account within <strong>30 days</strong> of your request.
          </p>
        </section>

        <section className="section">
          <h2>What gets deleted</h2>
          <ul>
            <li>Your alias and account record</li>
            <li>Your consent settings</li>
            <li>Your individual answer history and any photos/voice notes you submitted</li>
            <li>Your token balance and reward history</li>
          </ul>
        </section>

        <section className="section">
          <h2>What can't be deleted</h2>
          <p>
            Your answers may have already contributed to an aggregated, anonymized statistic (never
            published until at least 50 households stand behind it). Once published, that number
            doesn't identify you or trace back to your account — there's nothing in it to delete
            individually, the same way there's no way to "un-average" one data point out of an
            average.
          </p>
        </section>

        <section className="section">
          <p>
            See our <a href="/privacy">Privacy Policy</a> for more on what we collect and how it's used.
          </p>
        </section>

        <style
          dangerouslySetInnerHTML={{
            __html: `
        .page { max-width: 720px; margin: 0 auto; padding: 64px 24px 96px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
        .hero { text-align: center; margin-bottom: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .hero h1 { font-size: 2rem; margin: 8px 0 0; letter-spacing: -0.02em; color: #101418; }
        .notice { color: #B98F2F; font-size: 13px; margin: 8px 0 0; max-width: 480px; }
        .section { margin-bottom: 40px; }
        .section h2 { font-size: 1.2rem; margin: 0 0 12px; color: #101418; }
        .section p, .section li { color: #3a3934; font-size: 14.5px; line-height: 1.7; }
        .section ul { padding-left: 20px; margin: 0 0 12px; }
        .section li { margin-bottom: 8px; }
        .section a { color: #0E7A5C; font-weight: 600; }
        .logoDark { display: none; }
        @media (prefers-color-scheme: dark) {
          .hero h1, .section h2 { color: #F6F5F1; }
          .notice { color: #D4AA45; }
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
