import { DataPayLogo } from "./components/DataPayLogo";

export function MarketingHome(): JSX.Element {
  return (
    <main className="page">
      <section className="hero">
        <DataPayLogo size={52} tagline="Your data is your asset" />
        <h1>Real household demand, direct from real households</h1>
        <p className="lede">
          DataPay turns a few daily questions from local households into honest, aggregated demand
          signals — and gives organizations a direct channel to that same community: run priced
          survey questions, or list your own products for households to browse and reserve.
        </p>
        <div className="ctaRow">
          <a href="/org/signup" className="ctaPrimary">
            Sign up your organization
          </a>
          <a href="/registry" className="ctaSecondary">
            See the public demand registry
          </a>
        </div>
      </section>

      <section className="section">
        <h2>For organizations</h2>
        <ul>
          <li>
            <strong>Ask real households real questions.</strong> Set your own token reward per
            question — every submission goes through review before it reaches anyone.
          </li>
          <li>
            <strong>List your own products.</strong> Point at a spreadsheet or add items by hand;
            households browse and reserve a quantity directly. Fulfillment happens outside the
            app (cash, UPI, whatever you already use) — there's no in-app payment to set up.
          </li>
          <li>
            <strong>See real demand, not guesses.</strong> Aggregated signals only ever publish
            once at least 50 households stand behind a number — never one household's data alone.
          </li>
        </ul>
      </section>

      <section className="section">
        <h2>For households</h2>
        <p>
          A few short questions a day, small token rewards, and a say in what gets stocked
          locally — all under a private alias no organization ever sees directly.
        </p>
      </section>

      <section className="section">
        <p className="muted">
          Already an organization? <a href="/org/login">Log in</a>. New here?{" "}
          <a href="/org/signup">Create an account</a> — an ops reviewer activates every new
          organization before it can submit questions or list products.
        </p>
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .page { max-width: 720px; margin: 0 auto; padding: 64px 24px 96px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
        .hero { text-align: center; margin-bottom: 56px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .hero h1 { font-size: 2.1rem; margin: 8px 0 0; letter-spacing: -0.02em; color: #101418; line-height: 1.25; }
        .hero .lede { max-width: 560px; color: #5B6672; font-size: 15.5px; line-height: 1.7; margin: 0; }
        .ctaRow { display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap; justify-content: center; }
        .ctaPrimary { background: #0E7A5C; color: #fff; padding: 12px 22px; border-radius: 999px; font-weight: 700; font-size: 14.5px; text-decoration: none; }
        .ctaSecondary { border: 1px solid #E7E4DC; color: #101418; padding: 12px 22px; border-radius: 999px; font-weight: 600; font-size: 14.5px; text-decoration: none; }
        .section { margin-bottom: 40px; }
        .section h2 { font-size: 1.2rem; margin: 0 0 12px; color: #101418; }
        .section p, .section li { color: #3a3934; font-size: 14.5px; line-height: 1.7; }
        .section ul { padding-left: 20px; margin: 0 0 12px; }
        .section li { margin-bottom: 12px; }
        .section a { color: #0E7A5C; font-weight: 600; }
        .muted { color: #898781 !important; }
        @media (prefers-color-scheme: dark) {
          .page { background: #101418; }
          .hero h1, .section h2 { color: #F6F5F1; }
          .hero .lede { color: #c3c2b7; }
          .section p, .section li { color: #c3c2b7; }
          .section a { color: #12946F; }
          .ctaSecondary { border-color: #2a2f36; color: #F6F5F1; }
          .muted { color: #9b9a94 !important; }
        }
      `,
        }}
      />
    </main>
  );
}
