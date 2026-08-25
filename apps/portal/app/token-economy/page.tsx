import { getDemandAggregates } from "../data";
import { getTokenEconomyOverview } from "./core-api";
import { runAggregationAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TokenEconomyPage({
  searchParams,
}: {
  searchParams: { error?: string; ran?: string };
}): Promise<JSX.Element> {
  const [aggregates, overview] = await Promise.all([getDemandAggregates(), getTokenEconomyOverview()]);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Token economy</h1>
      <p className="lede">
        Every token is equal now — answering a question and buying something through the platform
        both earn the same kind of token (TOKEN_ECONOMY_REDESIGN.md). The supplier's 2% fee on every
        confirmed delivery accumulates in the corpus fund below; it's never spent down — only its
        future investment returns are meant to be distributed as dividends, which isn't built yet.
        Demand aggregates refresh hourly on a scheduled job; this button triggers an out-of-cycle run.
      </p>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Run failed:</strong> {searchParams.error}
        </div>
      )}
      {searchParams.ran === "aggregation" && <div className="successBanner">Aggregation run completed.</div>}

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
        <div className="tile">
          <span className="tileLabel">Published aggregates</span>
          <span className="tileValue">{aggregates.length}</span>
        </div>
      </div>

      <div className="actions">
        <form action={runAggregationAction}>
          <button type="submit" className="submitBtn">
            Run aggregation now
          </button>
        </form>
      </div>

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
