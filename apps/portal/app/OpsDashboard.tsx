// §10 boundary: this app, and every route added under it, may only ever query
// demand_aggregates / offers / linkages via the portal's restricted DB role.
// It must have no code path to responses, snaps, members, or Vault — the one
// exception is the token-economy overview tiles below, which go through
// Core API's admin endpoint (TOKEN_ECONOMY_REDESIGN.md), same as every other
// member-adjacent read elsewhere in this app (questions, zones, fund-projects).
import { IconChart, IconInbox, IconToken, IconUsers, IconVault } from "./components/icons";
import { getDemandAggregates } from "./data";
import { getPrivacyFloor } from "./lib/privacy-floor";
import { getTokenEconomyOverview } from "./token-economy/core-api";

/** Concentric rings echoing the brand mark — masthead decoration only. */
function HeadArt(): JSX.Element {
  return (
    <svg className="pageHeadArt" viewBox="0 0 300 300" aria-hidden="true">
      <g fill="none" stroke="var(--jade)" strokeWidth="1.5" opacity="0.5">
        <circle cx="150" cy="150" r="52" />
        <circle cx="150" cy="150" r="82" />
        <circle cx="150" cy="150" r="112" strokeDasharray="4 8" />
      </g>
      <circle cx="150" cy="150" r="24" fill="var(--jade)" opacity="0.14" />
    </svg>
  );
}

export async function OpsDashboard(): Promise<JSX.Element> {
  const [aggregates, overview, privacy] = await Promise.all([
    getDemandAggregates(),
    getTokenEconomyOverview(),
    getPrivacyFloor(),
  ]);
  const floor = privacy.floor;

  const rupees = overview.corpusFundPaise / 100;
  const perMember =
    overview.totalMembers > 0 ? Math.round((overview.totalTokens / overview.totalMembers) * 10) / 10 : 0;

  return (
    <main className="page">
      <header className="pageHead">
        <HeadArt />
        <p className="eyebrow">DataPay Portal · Ops</p>
        <h1>Demand &amp; token economy</h1>
        <p className="lede">
          Aggregated numbers only. Every row here is backed by at least {floor} households — nothing
          smaller is ever published, and this portal has no access to individual member data at all.
        </p>
      </header>

      <section className="section">
        <div className="sectionHead">
          <span className="sectionHeadIcon">
            <IconToken size={20} />
          </span>
          <h2>Token economy</h2>
        </div>
        <p className="lede">
          Every token is equal: answering a question and buying through the platform earn the same
          kind. Tokens are earned, never sold — no one can buy them, and they carry no promised cash
          value. A 2% supplier fee on each confirmed delivery builds the reward pool DataPay shares
          back with the members who created that demand. Any such share is a discretionary reward for
          contribution, not a return on a holding. Sharing isn&apos;t built yet, so the pool is
          currently only accumulating.
        </p>

        <div className="statRow">
          <div className="statCard">
            <span className="statCardIcon">
              <IconUsers size={22} />
            </span>
            <span>
              <span className="statCardLabel">Members</span>
              <span className="statCardValue">{overview.totalMembers.toLocaleString("en-IN")}</span>
            </span>
            <span className="statCardFoot">Households with an active alias</span>
          </div>

          <div className="statCard">
            <span className="statCardIcon">
              <IconToken size={22} />
            </span>
            <span>
              <span className="statCardLabel">Total tokens</span>
              <span className="statCardValue">{overview.totalTokens.toLocaleString("en-IN")}</span>
            </span>
            <span className="statCardFoot">
              {perMember} per member on average
            </span>
          </div>

          <div className="statCard statCardBrass">
            <span className="statCardIcon">
              <IconVault size={22} />
            </span>
            <span>
              <span className="statCardLabel">Reward pool</span>
              <span className="statCardValue value">
                ₹{rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </span>
            <span className="statCardFoot">Accumulating from supplier fees — not yet shared out</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="sectionHead">
          <span className="sectionHeadIcon">
            <IconChart size={20} />
          </span>
          <h2>Demand aggregates</h2>
        </div>
        {aggregates.length === 0 ? (
          <div className="emptyState">
            <span className="emptyStateIcon">
              <IconInbox size={26} />
            </span>
            <span className="emptyStateTitle">Nothing published yet</span>
            <p className="emptyStateBody">
              Aggregates appear here once a category has at least {floor} households behind it in one
              zone. Run the aggregation job from Token economy to compute a fresh pass.
            </p>
          </div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Zone</th>
                  <th>Level</th>
                  <th className="num">Cohort</th>
                  <th>Computed</th>
                </tr>
              </thead>
              <tbody>
                {aggregates.map((a) => (
                  <tr key={a.id}>
                    <td>{a.categoryName}</td>
                    <td>{a.zoneName}</td>
                    <td className="level">{a.zoneLevel}</td>
                    <td className="num">{a.cohortSize}</td>
                    <td className="muted">{new Date(a.computedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
