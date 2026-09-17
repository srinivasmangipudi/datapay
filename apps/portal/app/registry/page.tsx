import { DataPayLogo } from "../components/DataPayLogo";
import {
  DemandGroup,
  Distribution,
  getRegistry,
  PublishedQuestion,
  RegistryMeta,
  RegistryRow,
} from "./core-api";

export const dynamic = "force-dynamic";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

function households(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? "household" : "households"}`;
}

/** Cohorts are per category × zone, so the same household can back several rows. */
function totalHouseholds(groups: DemandGroup[]): number {
  return groups.reduce((sum, g) => sum + g.households, 0);
}

function OptionBars({ distribution }: { distribution: Distribution }): JSX.Element | null {
  if (distribution.kind !== "options") return null;
  // Bars are scaled against a full 100%, NOT against the largest option in the
  // question. Peak-scaling reads better on sparse data and is exactly the wrong
  // choice here: it would render "25% of households buy Sona Masuri" as a
  // full-width bar on a page whose entire claim is that its numbers mean what
  // they say. A question where every answer sits low should look low.
  return (
    <ul className="bars">
      {distribution.options.map((option) => (
        <li key={option.label} className="bar">
          <span className="barLabel">{option.label}</span>
          <span className="barTrack">
            <span className="barFill" style={{ width: `${Math.min(option.pct, 100)}%` }} />
          </span>
          <span className="barPct">{option.pct}%</span>
        </li>
      ))}
    </ul>
  );
}

function NumericSummary({ distribution }: { distribution: Distribution }): JSX.Element | null {
  if (distribution.kind !== "numeric") return null;
  return (
    <dl className="numeric">
      <div>
        <dt>Typical</dt>
        <dd>{formatNumber(Math.round(distribution.median))}</dd>
      </div>
      <div>
        <dt>Average</dt>
        <dd>{formatNumber(Math.round(distribution.mean))}</dd>
      </div>
      <div>
        <dt>Range</dt>
        <dd>
          {formatNumber(Math.round(distribution.min))}–{formatNumber(Math.round(distribution.max))}
        </dd>
      </div>
    </dl>
  );
}

function QuestionBlock({ question }: { question: PublishedQuestion }): JSX.Element {
  return (
    <div className="question">
      <p className="questionText">{question.text}</p>
      <OptionBars distribution={question.distribution} />
      <NumericSummary distribution={question.distribution} />
      <p className="questionMeta">
        {households(question.cohort_size)} answered
        {question.type === "intent_window" ? " · declared purchase intent" : ""}
      </p>
    </div>
  );
}

function GroupCard({ group, bucket }: { group: DemandGroup; bucket: "product" | "topic" }): JSX.Element {
  return (
    <article className={`group ${bucket === "topic" ? "groupTopic" : ""}`}>
      <header className="groupHead">
        <div>
          <h3 className="groupTitle">{group.category_name}</h3>
          <p className="groupZone">
            {group.zone_name} <span className="groupZoneLevel">· {group.zone_level}</span>
          </p>
        </div>
        {bucket === "product" && !group.has_open_offer ? (
          <span className="badge">No supplier yet</span>
        ) : null}
      </header>

      <div className="headline">
        <div className="headlineStat">
          <span className="headlineNumber">{formatNumber(group.households)}</span>
          <span className="headlineLabel">{group.households === 1 ? "household" : "households"}</span>
        </div>
        {bucket === "product" && group.intending !== null ? (
          <div className="headlineStat">
            <span className="headlineNumber headlineIntent">{formatNumber(group.intending)}</span>
            <span className="headlineLabel">plan to buy</span>
          </div>
        ) : null}
      </div>

      <div className="questions">
        {group.questions.map((question) => (
          <QuestionBlock key={question.question_id} question={question} />
        ))}
      </div>
    </article>
  );
}

function OpportunityCard({ row }: { row: RegistryRow }): JSX.Element {
  return (
    <div className="oppCard">
      <span className="oppBadge">Unmet demand</span>
      <span className="oppCategory">{row.category_name}</span>
      <span className="oppCohort">{formatNumber(row.cohort_size)}</span>
      <span className="oppCohortLabel">households want this, no supplier yet</span>
      <span className="oppZone">
        {row.zone_name} <span className="groupZoneLevel">· {row.zone_level}</span>
      </span>
    </div>
  );
}

function Empty({ floor }: { floor: number }): JSX.Element {
  return (
    <div className="empty">
      <p>
        Nothing has cleared publication yet. DataPay only ever publishes a number once at least{" "}
        {households(floor)} stand behind it — check back soon.
      </p>
    </div>
  );
}

/**
 * Shown only when a deployment is configured below LAW 3's production floor of
 * 50. A page whose whole claim is "these numbers are real and anonymous" has to
 * say so itself when it is running on a weaker guarantee — not leave that fact
 * in a server log where no reader will ever see it.
 */
function FloorNotice({ meta }: { meta: RegistryMeta }): JSX.Element | null {
  if (!meta.relaxed_floor) return null;
  return (
    <div className="notice">
      <strong>Pilot deployment.</strong> This instance publishes aggregates at a cohort floor of{" "}
      {meta.k_anon_floor}, below the production k-anonymity floor of {meta.production_floor}. Figures
      on this page are for pilot evaluation and are not production demand data.
    </div>
  );
}

export default async function RegistryPage(): Promise<JSX.Element> {
  const { registry, opportunities, products, topics, meta } = await getRegistry();
  const householdsRepresented = totalHouseholds(products) + totalHouseholds(topics);
  const zonesCovered = new Set([...products, ...topics].map((g) => g.zone_id)).size;

  return (
    <main className="page">
      <section className="hero">
        <DataPayLogo size={48} tagline="Your data is your asset" />
        <h1>The Demand Registry</h1>
        <p className="lede">
          Real households, collectivising real demand — anonymously. Every number below represents
          at least {households(meta.k_anon_floor)} before it can ever appear here; no individual
          response is ever shown, published, or identifiable.
        </p>
        <FloorNotice meta={meta} />
      </section>

      {householdsRepresented > 0 ? (
        <section className="summary">
          <div className="summaryStat">
            <span className="summaryNumber">{formatNumber(householdsRepresented)}</span>
            <span className="summaryLabel">household signals published</span>
          </div>
          <div className="summaryStat">
            <span className="summaryNumber">{products.length}</span>
            <span className="summaryLabel">product demand pools</span>
          </div>
          <div className="summaryStat">
            <span className="summaryNumber">{topics.length}</span>
            <span className="summaryLabel">community signal sets</span>
          </div>
          <div className="summaryStat">
            <span className="summaryNumber">{zonesCovered}</span>
            <span className="summaryLabel">zones covered</span>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="sectionHead">
          <span className="kicker">Bucket one</span>
          <h2>Product demand</h2>
        </div>
        <p className="sectionLede">
          What households actually buy, plan to buy, and choose between — by category and region.
          If you produce, distribute, or brand any of this, these are real, addressable pools of
          demand waiting to be served.
        </p>
        {products.length === 0 ? (
          <Empty floor={meta.k_anon_floor} />
        ) : (
          <div className="groups">
            {products.map((group) => (
              <GroupCard key={`${group.category_id}:${group.zone_id}`} group={group} bucket="product" />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="sectionHead">
          <span className="kicker">Bucket two</span>
          <h2>Community signals</h2>
        </div>
        <p className="sectionLede">
          Everything households are asked about that isn&apos;t a product — sanitation, water,
          energy, time, wellbeing. Not a market, but the clearest published picture of what these
          communities are living with.
        </p>
        {topics.length === 0 ? (
          <Empty floor={meta.k_anon_floor} />
        ) : (
          <div className="groups">
            {topics.map((group) => (
              <GroupCard key={`${group.category_id}:${group.zone_id}`} group={group} bucket="topic" />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="sectionHead">
          <h2>Opportunities</h2>
        </div>
        <p className="sectionLede">
          Real demand with no supplier serving it yet — for producers, distributors, and brands
          looking for their next market.
        </p>
        {opportunities.length === 0 ? (
          <div className="empty">
            <p>
              No unmet demand to show yet — either nothing&apos;s published, or every published
              category is already served.
            </p>
          </div>
        ) : (
          <div className="oppGrid">
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
        <p className="method">
          Method: responses are aggregated per question and per region, then the region is widened
          — village to panchayat to hobli to constituency — until at least{" "}
          {households(meta.k_anon_floor)} stand behind the figure. Anything that still can&apos;t clear that floor is not
          published at all. Open-ended written answers are never aggregated or published.
          {registry.length > 0 ? ` Last updated ${formatWhen(meta.generated_at)}.` : ""}
        </p>
      </footer>

      {/* dangerouslySetInnerHTML — see app/layout.tsx for why a plain <style>{`...`}</style>
          with a quoted value inside causes a hydration mismatch. This page's styles are kept
          fully self-contained (no globals.css dependency) so it can be lifted into a
          standalone site later with just this file. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .page { max-width: 1040px; margin: 0 auto; padding: 64px 24px 96px; }
        .hero { text-align: center; margin-bottom: 56px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
        .hero h1 { font-size: 2.4rem; margin: 8px 0 0; letter-spacing: -0.02em; color: #101418; }
        .lede { color: #52514e; max-width: 56ch; margin: 0; font-size: 15px; line-height: 1.7; }
        .notice { background: #fdf6e3; border: 1px solid #e8d9a8; color: #6b551a; border-radius: 12px; padding: 14px 18px; font-size: 13.5px; line-height: 1.6; max-width: 62ch; text-align: left; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 64px; padding: 24px; background: #fbfaf7; border: 1px solid #e1e0d9; border-radius: 16px; }
        .summaryStat { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; }
        .summaryNumber { font-size: 2rem; font-weight: 800; color: #0E7A5C; font-variant-numeric: tabular-nums; line-height: 1; }
        .summaryLabel { font-size: 12.5px; color: #898781; }
        .section { margin-bottom: 72px; }
        .sectionHead { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
        .kicker { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #B98F2F; background: #fdf6e3; border-radius: 999px; padding: 4px 10px; }
        .section h2 { font-size: 1.5rem; margin: 0; color: #101418; letter-spacing: -0.01em; }
        .sectionLede { color: #898781; font-size: 14px; margin: 0 0 28px; max-width: 62ch; line-height: 1.6; }
        .groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; align-items: start; }
        .group { display: flex; flex-direction: column; background: #fff; border: 1px solid #e1e0d9; border-radius: 16px; padding: 24px; }
        .groupTopic { background: #fcfcfa; }
        .groupHead { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .groupTitle { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #0E7A5C; margin: 0; }
        .groupTopic .groupTitle { color: #3E5C76; }
        .groupZone { font-size: 13.5px; color: #101418; font-weight: 600; margin: 4px 0 0; }
        .groupZoneLevel { color: #898781; font-weight: 400; }
        .badge { flex-shrink: 0; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #8a4b1f; background: #fdf0e3; border: 1px solid #f0d8bf; border-radius: 999px; padding: 4px 9px; }
        .headline { display: flex; gap: 28px; margin: 18px 0 4px; }
        .headlineStat { display: flex; flex-direction: column; }
        .headlineNumber { font-size: 2.1rem; font-weight: 800; color: #B98F2F; line-height: 1; font-variant-numeric: tabular-nums; }
        .headlineIntent { color: #0E7A5C; }
        .headlineLabel { font-size: 12px; color: #898781; margin-top: 4px; }
        .questions { display: flex; flex-direction: column; gap: 18px; margin-top: 20px; padding-top: 18px; border-top: 1px solid #f0efe9; }
        .questionText { font-size: 13.5px; color: #101418; margin: 0 0 10px; line-height: 1.5; font-weight: 600; }
        .questionMeta { font-size: 11.5px; color: #a8a69f; margin: 8px 0 0; }
        .bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .bar { display: grid; grid-template-columns: minmax(70px, 34%) 1fr auto; align-items: center; gap: 10px; }
        .barLabel { font-size: 12px; color: #52514e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .barTrack { height: 8px; background: #f0efe9; border-radius: 999px; overflow: hidden; }
        .barFill { display: block; height: 100%; background: #0E7A5C; border-radius: 999px; }
        .groupTopic .barFill { background: #3E5C76; }
        .barPct { font-size: 11.5px; color: #898781; font-variant-numeric: tabular-nums; min-width: 38px; text-align: right; }
        .numeric { display: flex; gap: 20px; margin: 0; }
        .numeric div { display: flex; flex-direction: column; gap: 2px; }
        .numeric dt { font-size: 11px; color: #a8a69f; text-transform: uppercase; letter-spacing: 0.05em; }
        .numeric dd { font-size: 17px; font-weight: 700; color: #101418; margin: 0; font-variant-numeric: tabular-nums; }
        .oppGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .oppCard { display: flex; flex-direction: column; background: #fff; border: 1px solid #f0d8bf; border-radius: 14px; padding: 22px; gap: 2px; }
        .oppBadge { align-self: flex-start; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #8a4b1f; background: #fdf0e3; border-radius: 999px; padding: 4px 9px; margin-bottom: 12px; }
        .oppCategory { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #0E7A5C; }
        .oppCohort { font-size: 2.2rem; font-weight: 800; color: #B98F2F; margin-top: 8px; line-height: 1; font-variant-numeric: tabular-nums; }
        .oppCohortLabel { font-size: 12.5px; color: #898781; margin-bottom: 14px; }
        .oppZone { font-size: 14px; color: #101418; font-weight: 600; }
        .empty { background: #fbfaf7; border: 1px dashed #e1e0d9; border-radius: 14px; padding: 32px; text-align: center; }
        .empty p { color: #898781; font-size: 14px; margin: 0; max-width: 52ch; margin-inline: auto; line-height: 1.6; }
        .footer { border-top: 1px solid #e1e0d9; padding-top: 28px; }
        .footer p { color: #898781; font-size: 13px; line-height: 1.7; margin: 0 0 12px; max-width: 64ch; }
        .method { color: #a8a69f; font-size: 12px; }
        @media (max-width: 640px) {
          .page { padding: 40px 16px 64px; }
          .hero h1 { font-size: 1.9rem; }
          .groups { grid-template-columns: 1fr; }
          .headline { gap: 20px; }
        }
      `,
        }}
      />
    </main>
  );
}
