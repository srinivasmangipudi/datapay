import { DataPayLogo } from "../components/DataPayLogo";
import { PublicNav } from "../components/PublicNav";
import { getLang } from "../lib/language";

export const dynamic = "force-dynamic";

const LAST_UPDATED = "September 9, 2026";

const NOTICE = {
  en: null,
  kn: "ಈ ಕಾನೂನು ಪಠ್ಯದ ಕನ್ನಡ ಅನುವಾದವನ್ನು ನಾವು ಇನ್ನೂ ಪರಿಶೀಲಿಸಿಲ್ಲ, ಆದ್ದರಿಂದ ತಪ್ಪುಗಳನ್ನು ತಪ್ಪಿಸಲು ಕೆಳಗಿನ ನೀತಿಯನ್ನು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ತೋರಿಸಲಾಗಿದೆ.",
} as const;

export default function ChildSafetyStandardsPage(): JSX.Element {
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
          <h1>Child Safety Standards</h1>
          <p className="lede">Last updated {LAST_UPDATED}</p>
          {NOTICE[lang] && <p className="notice">{NOTICE[lang]}</p>}
        </section>

        <section className="section">
          <h2>Our commitment</h2>
          <p>
            DataPay has zero tolerance for child sexual abuse and exploitation (CSAE) of any kind.
            We design the product to minimize the surfaces where this kind of harm could occur, and
            we commit to removing content, disabling accounts, and reporting to the relevant
            authorities the moment we become aware of anything that violates this standard.
          </p>
        </section>

        <section className="section">
          <h2>How the app is designed to reduce risk</h2>
          <ul>
            <li>Members never message, contact, or see any other member directly — there is no
              chat, no profile browsing, and no public feed.</li>
            <li>Any photo or voice note a member submits is attached only to their own private
              answer to a specific household question, is reviewed as part of our normal
              verification process, and is never shown to other members.</li>
            <li>Account creation requires phone number verification.</li>
          </ul>
        </section>

        <section className="section">
          <h2>How to report a concern</h2>
          <p>
            Inside the app, open the <strong>Vault</strong> tab and tap{" "}
            <strong>"Report a concern"</strong> to email us directly. You can also email{" "}
            <a href="mailto:srinivas@socratus.org">srinivas@socratus.org</a> at any time, whether or
            not you're a member. We review every report personally and promptly.
          </p>
        </section>

        <section className="section">
          <h2>Compliance</h2>
          <p>
            DataPay complies with all applicable child safety laws and reports confirmed CSAE
            content or activity to the relevant regional and national authorities, including India's
            National Center for Missing &amp; Exploited Children reporting channels and NCMEC's
            CyberTipline where applicable.
          </p>
        </section>

        <section className="section">
          <h2>Designated contact</h2>
          <p>
            Our designated point of contact for child safety matters is{" "}
            <a href="mailto:srinivas@socratus.org">srinivas@socratus.org</a>.
          </p>
        </section>

        <section className="section">
          <p>
            See our <a href="/privacy">Privacy Policy</a> for more on what we collect and how it's
            used.
          </p>
        </section>

        <style
          dangerouslySetInnerHTML={{
            __html: `
        .page { max-width: 720px; margin: 0 auto; padding: 64px 24px 96px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
        .hero { text-align: center; margin-bottom: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .hero h1 { font-size: 2rem; margin: 8px 0 0; letter-spacing: -0.02em; color: #101418; }
        .lede { color: #898781; font-size: 13px; margin: 0; }
        .notice { color: #B98F2F; font-size: 13px; margin: 8px 0 0; max-width: 480px; }
        .section { margin-bottom: 40px; }
        .section h2 { font-size: 1.2rem; margin: 0 0 12px; color: #101418; }
        .section p, .section li { color: #3a3934; font-size: 14.5px; line-height: 1.7; }
        .section ul { padding-left: 20px; margin: 0 0 12px; }
        .section li { margin-bottom: 8px; }
        .section a { color: #0E7A5C; font-weight: 600; }
        .logoDark { display: none; }
        @media (prefers-color-scheme: dark) {
          .page { background: #101418; }
          .hero h1, .section h2 { color: #F6F5F1; }
          .lede { color: #9b9a94; }
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
