import { DataPayLogo } from "../components/DataPayLogo";
import { PublicNav } from "../components/PublicNav";

export const dynamic = "force-static";

export default function AboutPage(): JSX.Element {
  return (
    <>
      <PublicNav />
      <main className="page">
        <section className="hero">
          <span className="logoLight">
            <DataPayLogo size={44} tagline="Your data is your asset" />
          </span>
          <span className="logoDark">
            <DataPayLogo size={44} dark tagline="Your data is your asset" />
          </span>
          <h1>About DataPay</h1>
        </section>

        <section className="section">
          <h2>The idea</h2>
          <p>
            Every day, households already generate the data that describes what a community
            actually needs — what they're buying, what they're running low on, what they'd pay
            for. That data has always been valuable to someone. Historically, it just hasn't been
            valuable to the household that generated it.
          </p>
          <p>
            DataPay changes who benefits. Households answer a few short questions a day and
            browse a real product catalog, earning tokens either way. Organizations get a direct,
            honest channel to that same community — never a household's identity, only an
            aggregated signal real enough to act on.
          </p>
        </section>

        <section className="section">
          <h2>What we won't do</h2>
          <ul>
            <li>Sell or share an individual household's answers, identity, or location.</li>
            <li>Publish a number before at least 50 households stand behind it.</li>
            <li>Let an organization see a member directly — fulfillment stays identity-blind.</li>
            <li>Pretend a feature is finished when it isn't — see our <a href="/privacy">privacy policy</a> for exactly what's built today and what's still honestly in progress.</li>
          </ul>
        </section>

        <section className="section">
          <h2>Who it's for</h2>
          <p>
            Household members who want a small, honest reward for information they're already
            generating — and organizations, brands, and local suppliers who want real demand
            signals instead of guesses, and a direct way to reach the community that produced
            them.
          </p>
        </section>

        <section className="section">
          <p>
            Questions? <a href="mailto:srinivas@socratus.org">srinivas@socratus.org</a> — or see the{" "}
            <a href="/registry">public demand registry</a> for what's already being published.
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
