import { DataPayLogo } from "./components/DataPayLogo";
import { PublicNav } from "./components/PublicNav";
import { SystemDiagram } from "./SystemDiagram";

const STEPS = [
  {
    title: "Answer & browse",
    text: "A few daily questions, a token reward for each — plus a real product catalog to browse and reserve.",
    icon: (
      <path
        d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Aggregated privately",
    text: "Every answer is tied to a private alias only — never a name or phone number an organization could see.",
    icon: (
      <path
        d="M12 2l8 3.5v5c0 5-3.4 8.7-8 10.5-4.6-1.8-8-5.5-8-10.5v-5L12 2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Real signals surface",
    text: "A number only ever publishes once at least 50 households stand behind it — never one household alone.",
    icon: (
      <path
        d="M4 19V9M11 19V4M18 19v-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Organizations respond",
    text: "Ask priced questions, or list products directly — households browse and reserve, no middleman.",
    icon: (
      <path
        d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export function MarketingHome(): JSX.Element {
  return (
    <>
      <PublicNav />
      <main className="mkPage">
        <section className="mkHero">
          <span className="mkLogoLight">
            <DataPayLogo size={52} tagline="Your data is your asset" />
          </span>
          <span className="mkLogoDark">
            <DataPayLogo size={52} dark tagline="Your data is your asset" />
          </span>
          <h1>Real household demand, direct from real households</h1>
          <p className="mkLede">
            DataPay turns a few daily questions from local households into honest, aggregated
            demand signals — and gives organizations a direct channel to that same community: run
            priced survey questions, or list your own products for households to browse and
            reserve.
          </p>
          <div className="mkCtaRow">
            <a href="/org/signup" className="mkCtaPrimary">
              Sign up your organization
            </a>
            <a href="#how-it-works" className="mkCtaSecondary">
              See how it works
            </a>
          </div>
        </section>

        <section id="how-it-works" className="mkSection">
          <p className="mkEyebrow">How it works</p>
          <h2>From a household's answer to a real business decision</h2>
          <div className="mkSteps">
            {STEPS.map((s, i) => (
              <div className="mkStep" key={s.title}>
                <span className="mkStepNum">{i + 1}</span>
                <svg className="mkStepIcon" viewBox="0 0 24 24" width="26" height="26">
                  {s.icon}
                </svg>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mkSection mkSectionDiagram">
          <p className="mkEyebrow">The system</p>
          <h2>Two flows, always — data up, value back down</h2>
          <p className="mkSectionLede">
            Households never deal with organizations directly, and organizations never see a
            household directly. DataPay sits in between, on purpose.
          </p>
          <div className="mkDiagramWrap">
            <SystemDiagram />
          </div>
        </section>

        <section id="for-organizations" className="mkSection">
          <p className="mkEyebrow">For organizations</p>
          <h2>A direct channel to real local demand</h2>
          <div className="mkCards">
            <div className="mkCard">
              <h3>Ask real households real questions</h3>
              <p>
                Set your own token reward per question. Every submission is reviewed before it
                reaches anyone — never auto-published.
              </p>
            </div>
            <div className="mkCard">
              <h3>List your own products</h3>
              <p>
                Point at a spreadsheet or add items by hand; households browse and reserve
                directly. Fulfillment happens outside the app — no in-app payment to set up.
              </p>
            </div>
            <div className="mkCard">
              <h3>See real demand, not guesses</h3>
              <p>
                Aggregated signals only ever publish once at least 50 households stand behind a
                number — never one household's data alone.
              </p>
            </div>
          </div>
          <a href="/org/signup" className="mkCtaPrimary mkCtaInline">
            Sign up your organization
          </a>
        </section>

        <section className="mkSection mkSectionProtection">
          <p className="mkEyebrow">Data protection</p>
          <h2>Privacy isn't a policy here — it's the architecture</h2>
          <div className="mkProtectionGrid">
            <div className="mkProtectionItem">
              <strong>Private alias, always.</strong>
              <span>Organizations only ever see an alias — never a name, phone number, or address.</span>
            </div>
            <div className="mkProtectionItem">
              <strong>Cohort floor of 50.</strong>
              <span>No number publishes until at least 50 households stand behind it.</span>
            </div>
            <div className="mkProtectionItem">
              <strong>No raw location stored.</strong>
              <span>Approximate area only, used to match the nearest zone — never exact coordinates.</span>
            </div>
            <div className="mkProtectionItem">
              <strong>You control sharing.</strong>
              <span>Every category of data sharing can be turned off, any time, in the app.</span>
            </div>
          </div>
          <p className="mkProtectionLink">
            <a href="/privacy">Read the full privacy policy →</a>
          </p>
        </section>

        <section className="mkSection mkSectionAbout">
          <p className="mkEyebrow">About</p>
          <h2>Built for households first</h2>
          <p className="mkSectionLede">
            DataPay started from a simple idea: the data that already describes what a community
            needs is valuable, and the household generating it should be the one who benefits —
            in tokens, in better local availability, and in never being sold as a name and a
            phone number. <a href="/about">More about DataPay →</a>
          </p>
        </section>

        <section className="mkSection mkSectionFinalCta">
          <h2>Ready to reach real local demand?</h2>
          <div className="mkCtaRow">
            <a href="/org/signup" className="mkCtaPrimary">
              Sign up your organization
            </a>
            <a href="/registry" className="mkCtaSecondary">
              See the public demand registry
            </a>
          </div>
        </section>

        <footer className="mkFooter">
          <div className="mkFooterBrand">
            <span className="mkLogoLight">
              <DataPayLogo size={28} tagline="Your data is your asset" />
            </span>
            <span className="mkLogoDark">
              <DataPayLogo size={28} dark tagline="Your data is your asset" />
            </span>
          </div>
          <div className="mkFooterLinks">
            <a href="/about">About</a>
            <a href="/privacy">Privacy</a>
            <a href="/delete-account">Delete account</a>
            <a href="/child-safety">Child safety</a>
            <a href="/registry">Demand registry</a>
            <a href="/org/login">Organization login</a>
            <a href="mailto:srinivas@socratus.org">Contact</a>
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
