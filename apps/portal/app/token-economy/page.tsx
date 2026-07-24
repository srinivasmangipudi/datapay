import { getDemandAggregates, getTokenRateHistory } from "../data";
import { TokenRateChart } from "../TokenRateChart";
import { runAggregationAction, runTokenRateAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TokenEconomyPage({
  searchParams,
}: {
  searchParams: { error?: string; ran?: string };
}): Promise<JSX.Element> {
  const [tokenRateHistory, aggregates] = await Promise.all([
    getTokenRateHistory(),
    getDemandAggregates(),
  ]);
  const current = tokenRateHistory[tokenRateHistory.length - 1] ?? null;

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Token economy</h1>
      <p className="lede">
        The token rate is fixed on a scheduled cadence (§6C, every 3 days by default) and demand
        aggregates refresh hourly — both scheduled jobs already run unattended. These buttons trigger
        an out-of-cycle run right now, same computation either way.
      </p>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Run failed:</strong> {searchParams.error}
        </div>
      )}
      {searchParams.ran === "token-rate" && <div className="successBanner">Token rate recomputed.</div>}
      {searchParams.ran === "aggregation" && <div className="successBanner">Aggregation run completed.</div>}

      <div className="tiles">
        <div className="tile">
          <span className="tileLabel">Current token rate</span>
          <span className="tileValue value">{current ? `₹${(current.ratePaise / 100).toFixed(2)}` : "—"}</span>
        </div>
        <div className="tile">
          <span className="tileLabel">Published aggregates</span>
          <span className="tileValue">{aggregates.length}</span>
        </div>
      </div>

      <div className="actions">
        <form action={runTokenRateAction}>
          <button type="submit" className="submitBtn">
            Run token rate now
          </button>
        </form>
        <form action={runAggregationAction}>
          <button type="submit" className="submitBtn">
            Run aggregation now
          </button>
        </form>
      </div>

      <section className="section">
        <h2>Token rate — history</h2>
        <TokenRateChart points={tokenRateHistory} />
      </section>

      <section className="section">
        <h2>Demand aggregates</h2>
        {aggregates.length === 0 ? (
          <p className="empty">No aggregates published yet.</p>
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
