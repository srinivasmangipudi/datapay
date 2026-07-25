// §10 boundary: this app, and every route added under it, may only ever query
// demand_aggregates / offers / linkages via the portal's restricted DB role.
// It must have no code path to responses, snaps, members, or Vault — the one
// exception is the token-economy overview tiles below, which go through
// Core API's admin endpoint (SPEC.md §40), same as every other member-
// adjacent read elsewhere in this app (questions, zones, fund-projects).
import { getDemandAggregates, getTokenRateHistory } from "./data";
import { getTokenEconomyOverview } from "./token-economy/core-api";
import { TokenRateChart } from "./TokenRateChart";

export const dynamic = "force-dynamic"; // ops dashboard — always current, never cached

export default async function PortalHome(): Promise<JSX.Element> {
  const [tokenRateHistory, aggregates, overview] = await Promise.all([
    getTokenRateHistory(),
    getDemandAggregates(),
    getTokenEconomyOverview(),
  ]);
  const current = tokenRateHistory[tokenRateHistory.length - 1] ?? null;

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Demand &amp; token rate</h1>
      <p className="lede">
        Aggregates only — every row below cleared the k-anonymity floor (cohort ≥ 50) before it
        could reach this screen. This portal's database role has no grant on member-level tables.
      </p>

      <div className="tiles">
        <div className="tile">
          <span className="tileLabel">Current token rate</span>
          <span className="tileValue value">
            {current ? `₹${(current.ratePaise / 100).toFixed(2)}` : "—"}
          </span>
        </div>
        <div className="tile">
          <span className="tileLabel">Published aggregates</span>
          <span className="tileValue">{aggregates.length}</span>
        </div>
        <div className="tile">
          <span className="tileLabel">Rate last computed</span>
          <span className="tileValue small">
            {current ? new Date(current.computedAt).toLocaleString() : "—"}
          </span>
        </div>
      </div>

      <section className="section">
        <h2>Token economics</h2>
        <p className="lede">
          Outstanding is what members can still redeem — an unbacked promise. A token becomes
          realised, and gets a real rupee reserved 1:1 against it, only once the purchase it was
          redeemed against is actually confirmed delivered (SPEC.md §40) — not at redemption itself.
        </p>
        <div className="tiles">
          <div className="tile">
            <span className="tileLabel">Members</span>
            <span className="tileValue">{overview.totalMembers}</span>
          </div>
          <div className="tile">
            <span className="tileLabel">◇ Outstanding tokens</span>
            <span className="tileValue">{overview.outstandingTokens}</span>
          </div>
          <div className="tile">
            <span className="tileLabel">◆ Realised tokens</span>
            <span className="tileValue">{overview.realisedTokens}</span>
          </div>
          <div className="tile">
            <span className="tileLabel">Reserved (real ₹)</span>
            <span className="tileValue value">₹{(overview.reservedPaise / 100).toFixed(2)}</span>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Token rate — history</h2>
        <TokenRateChart points={tokenRateHistory} />
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
