// §10 boundary: this app, and every route added under it, may only ever query
// demand_aggregates / offers / linkages via the portal's restricted DB role.
// It must have no code path to responses, snaps, members, or Vault — the one
// exception is the token-economy overview tiles below, which go through
// Core API's admin endpoint (TOKEN_ECONOMY_REDESIGN.md), same as every other
// member-adjacent read elsewhere in this app (questions, zones, fund-projects).
import { getDemandAggregates } from "./data";
import { getTokenEconomyOverview } from "./token-economy/core-api";

export async function OpsDashboard(): Promise<JSX.Element> {
  const [aggregates, overview] = await Promise.all([getDemandAggregates(), getTokenEconomyOverview()]);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Demand &amp; token economy</h1>
      <p className="lede">
        Aggregated numbers only. Every row here is backed by at least 50 households — nothing
        smaller is ever published, and this portal has no access to individual member data at all.
      </p>

      <section className="section">
        <h2>Token economy</h2>
        <p className="lede">
          Every token is equal: answering a question and buying through the platform earn the same
          kind. A 2% supplier fee on each confirmed delivery accumulates in the corpus fund, which
          is never spent down — only its future investment returns are meant to be paid out as
          dividends. That payout isn't built yet, so the fund is currently accumulating, not
          distributing.
        </p>
        <div className="tiles">
          <div className="tile">
            <span className="tileLabel">Members</span>
            <span className="tileValue">{overview.totalMembers}</span>
          </div>
          <div className="tile">
            <span className="tileLabel">Total tokens</span>
            <span className="tileValue">{overview.totalTokens}</span>
          </div>
          <div className="tile">
            <span className="tileLabel">Corpus fund (accumulated)</span>
            <span className="tileValue value">₹{(overview.corpusFundPaise / 100).toFixed(2)}</span>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Demand aggregates</h2>
        {aggregates.length === 0 ? (
          <p className="empty">No aggregates published yet — run the aggregation job.</p>
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
