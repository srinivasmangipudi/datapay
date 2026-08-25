// §10 boundary: this app, and every route added under it, may only ever query
// demand_aggregates / offers / linkages via the portal's restricted DB role.
// It must have no code path to responses, snaps, members, or Vault — the one
// exception is the token-economy overview tiles below, which go through
// Core API's admin endpoint (TOKEN_ECONOMY_REDESIGN.md), same as every other
// member-adjacent read elsewhere in this app (questions, zones, fund-projects).
import { getDemandAggregates } from "./data";
import { getTokenEconomyOverview } from "./token-economy/core-api";

export const dynamic = "force-dynamic"; // ops dashboard — always current, never cached

export default async function PortalHome(): Promise<JSX.Element> {
  const [aggregates, overview] = await Promise.all([getDemandAggregates(), getTokenEconomyOverview()]);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Demand &amp; token economy</h1>
      <p className="lede">
        Aggregates only — every row below cleared the k-anonymity floor (cohort ≥ 50) before it
        could reach this screen. This portal's database role has no grant on member-level tables.
      </p>

      <section className="section">
        <h2>Token economy</h2>
        <p className="lede">
          Every token is equal — answering a question and buying something through the platform
          both earn the same kind of token, no separate "realised" state (TOKEN_ECONOMY_REDESIGN.md).
          On every confirmed delivery, the supplier's 2% fee goes into the corpus fund below; the
          corpus is never spent down — only its future investment returns are meant to be
          distributed as dividends, which isn't built yet (no decided distribution cadence, no
          real banking/FD integration). This is the honest current state: accumulating, not yet
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
