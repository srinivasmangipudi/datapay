import { DataPayLogo } from "../components/DataPayLogo";

export const dynamic = "force-static";

const LAST_UPDATED = "September 8, 2026";

export default function PrivacyPolicyPage(): JSX.Element {
  return (
    <main className="page">
      <section className="hero">
        <DataPayLogo size={44} tagline="Your data is your asset" />
        <h1>Privacy Policy</h1>
        <p className="lede">Last updated {LAST_UPDATED}</p>
      </section>

      <section className="section">
        <h2>What DataPay is</h2>
        <p>
          DataPay is a household demand-aggregation platform. Members answer short daily questions
          about everyday household needs; DataPay combines those answers across many households
          into real, anonymized demand signals that brands, producers, and local suppliers can
          respond to. Members earn tokens for answering and for purchases made through the
          platform.
        </p>
      </section>

      <section className="section">
        <h2>Information we collect</h2>
        <ul>
          <li><strong>Name and phone number</strong> — used only to create and verify your account. Never shown to brands or partners.</li>
          <li><strong>Approximate location</strong> — used only to assign your household to the right local area. We never store precise/exact coordinates.</li>
          <li><strong>Photos or voice recordings</strong> — only if you choose to answer a specific question that way; entirely optional.</li>
          <li><strong>Your answers to questions, and your token/reward history</strong> — the core of what the app does.</li>
        </ul>
        <p>
          We do not collect health data, payment card details, contacts, or browsing history.
        </p>
      </section>

      <section className="section">
        <h2>Your public alias</h2>
        <p>
          The moment you join, DataPay assigns you a private alias. Brands and partners who see
          demand data generated from your answers only ever see this alias — never your real name
          or phone number. Photos or voice notes you submit as evidence on an answer may be
          processed by a third-party AI service (Google's Gemini API) to extract useful
          information (e.g. what a product label says) — this is processing on our behalf, not a
          sale or share of your data for anyone else's purposes.
        </p>
      </section>

      <section className="section">
        <h2>What we share</h2>
        <p>
          We only ever share <strong>aggregated, anonymized</strong> demand data — never an
          individual member's answers, location, or identity. A number is only ever published once
          at least 50 households stand behind it.
        </p>
      </section>

      <section className="section">
        <h2>Data security</h2>
        <p>
          All data in transit between the app and our servers is encrypted (HTTPS/TLS). Your real
          identity and your alias are kept in separate systems by design, so that no single
          compromise can connect the two.
        </p>
      </section>

      <section className="section">
        <h2>Your choices</h2>
        <p>
          Inside the app's Vault tab, you can review and turn off any category of data sharing at
          any time. To request deletion of your account and data entirely, see our{" "}
          <a href="/delete-account">account deletion page</a>.
        </p>
      </section>

      <section className="section">
        <h2>Children's privacy</h2>
        <p>
          DataPay is not directed at children and requires phone verification to create an
          account.
        </p>
      </section>

      <section className="section">
        <h2>Changes to this policy</h2>
        <p>
          If we make material changes to this policy, we'll update the date above and, where
          appropriate, notify members in the app.
        </p>
      </section>

      <section className="section">
        <h2>Contact us</h2>
        <p>
          Questions about this policy or your data: <a href="mailto:srinivas@socratus.org">srinivas@socratus.org</a>
        </p>
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .page { max-width: 720px; margin: 0 auto; padding: 64px 24px 96px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
        .hero { text-align: center; margin-bottom: 56px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .hero h1 { font-size: 2rem; margin: 8px 0 0; letter-spacing: -0.02em; color: #101418; }
        .lede { color: #898781; font-size: 13px; margin: 0; }
        .section { margin-bottom: 40px; }
        .section h2 { font-size: 1.2rem; margin: 0 0 12px; color: #101418; }
        .section p, .section li { color: #3a3934; font-size: 14.5px; line-height: 1.7; }
        .section ul { padding-left: 20px; margin: 0 0 12px; }
        .section li { margin-bottom: 8px; }
        .section a { color: #0E7A5C; font-weight: 600; }
        @media (prefers-color-scheme: dark) {
          .page { background: #101418; }
          .hero h1, .section h2 { color: #F6F5F1; }
          .lede { color: #9b9a94; }
          .section p, .section li { color: #c3c2b7; }
          .section a { color: #12946F; }
        }
      `,
        }}
      />
    </main>
  );
}
