import { DataPayLogo } from "../components/DataPayLogo";
import { getRegistry, RegistryRow } from "./core-api";

export const dynamic = "force-dynamic";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function RegistryCard({ row }: { row: RegistryRow }): JSX.Element {
  return (
    <div className="card">
      <span className="cardCategory">{row.category_name}</span>
      <span className="cardCohort">{row.cohort_size}</span>
      <span className="cardCohortLabel">households</span>
      <span className="cardZone">
        {row.zone_name} <span className="cardZoneLevel">· {row.zone_level}</span>
      </span>
      <span className="cardWhen">Published {formatWhen(row.computed_at)}</span>
    </div>
  );
}

function OpportunityCard({ row }: { row: RegistryRow }): JSX.Element {
  return (
    <div className="card cardOpportunity">
      <span className="oppBadge">Unmet demand</span>
      <span className="cardCategory">{row.category_name}</span>
      <span className="cardCohort">{row.cohort_size}</span>
      <span className="cardCohortLabel">households want this, no supplier yet</span>
      <span className="cardZone">
        {row.zone_name} <span className="cardZoneLevel">· {row.zone_level}</span>
      </span>
    </div>
  );
}

export default async function RegistryPage(): Promise<JSX.Element> {
  const { registry, opportunities } = await getRegistry();

  return (
    <main className="page">
      <section className="hero">
        <DataPayLogo size={48} tagline="Your data is your asset" />
        <h1>The Demand Registry</h1>
        <p className="lede">
          Real households, collectivising real demand — anonymously. Every number below represents
          at least 50 households before it can ever appear here; no individual response is ever
          shown, published, or identifiable.
        </p>
      </section>

      <section className="section">
        <h2>Published demand</h2>
        <p className="sectionLede">
          What real, aggregated household demand looks like right now, across every category and
          region DataPay operates in.
        </p>
        {registry.length === 0 ? (
          <div className="empty">
            <p>
              The first aggregates are still forming. DataPay only ever publishes a number once at
              least 50 households stand behind it — check back soon.
            </p>
          </div>
        ) : (
          <div className="grid">
            {registry.map((row) => (
              <RegistryCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>Opportunities</h2>
        <p className="sectionLede">
          Real demand with no supplier serving it yet — for producers, distributors, and brands
          looking for their next market.
        </p>
        {opportunities.length === 0 ? (
          <div className="empty">
            <p>No unmet demand to show yet — either nothing's published, or every published category is already served.</p>
          </div>
        ) : (
          <div className="grid">
            {opportunities.map((row) => (
              <OpportunityCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>

      <footer className="footer">
        <p>
          DataPay collectivises household demand — anonymously — so people get better prices,
          communities get a fund, and producers reach the market directly.
        </p>
      </footer>

      {/* dangerouslySetInnerHTML — see app/layout.tsx for why a plain <style>{`...`}</style>
          with a quoted value inside causes a hydration mismatch. This page's styles are kept
          fully self-contained (no globals.css dependency) so it can be lifted into a
          standalone site later with just this file. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .page { max-width: 960px; margin: 0 auto; padding: 64px 24px 96px; }
        .hero { text-align: center; margin-bottom: 72px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
        .hero h1 { font-size: 2.4rem; margin: 8px 0 0; letter-spacing: -0.02em; color: #101418; }
        .lede { color: #52514e; max-width: 56ch; margin: 0; font-size: 15px; line-height: 1.7; }
        .section { margin-bottom: 64px; }
        .section h2 { font-size: 1.5rem; margin: 0 0 8px; color: #101418; }
        .sectionLede { color: #898781; font-size: 14px; margin: 0 0 28px; max-width: 60ch; line-height: 1.6; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .card { display: flex; flex-direction: column; background: #fff; border: 1px solid #e1e0d9; border-radius: 14px; padding: 22px; gap: 2px; }
        .cardCategory { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #0E7A5C; }
        .cardCohort { font-size: 2.2rem; font-weight: 800; color: #B98F2F; margin-top: 8px; line-height: 1; font-variant-numeric: tabular-nums; }
        .cardCohortLabel { font-size: 12.5px; color: #898781; margin-bottom: 14px; }
        .cardZone { font-size: 14px; color: #101418; font-weight: 600; }
        .cardZoneLevel { font-weight: 500; color: #898781; text-transform: capitalize; }
        .cardWhen { font-size: 12px; color: #898781; margin-top: 10px; }
        .cardOpportunity { border-color: #B98F2F; background: #FBF2DD; }
        .oppBadge { align-self: flex-start; background: #B98F2F; color: #fff; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 3px 9px; border-radius: 999px; margin-bottom: 10px; }
        .empty { border: 1px dashed #d8d7cf; border-radius: 14px; padding: 32px; text-align: center; color: #898781; font-size: 14px; line-height: 1.6; }
        .footer { border-top: 1px solid #e1e0d9; padding-top: 28px; text-align: center; }
        .footer p { color: #898781; font-size: 13px; max-width: 60ch; margin: 0 auto; line-height: 1.6; }
        @media (prefers-color-scheme: dark) {
          .page { background: #101418; }
          .hero h1, .section h2, .cardZone { color: #F6F5F1; }
          .lede { color: #c3c2b7; }
          .sectionLede, .cardCohortLabel, .cardWhen, .cardZoneLevel, .footer p { color: #8A939B; }
          .card { background: #14161b; border-color: #2c2c2a; }
          .cardCategory { color: #12946F; }
          .cardCohort { color: #D4AA45; }
          .cardOpportunity { border-color: #D4AA45; background: #241d0f; }
          .oppBadge { background: #D4AA45; color: #101418; }
          .empty { border-color: #2c2c2a; }
          .footer { border-top-color: #2c2c2a; }
        }
      `,
        }}
      />
    </main>
  );
}
