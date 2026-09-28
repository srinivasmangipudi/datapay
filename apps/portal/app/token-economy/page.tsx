import { getDemandAggregates } from "../data";
import { getTokenEconomyOverview, getTokenRateDetail } from "./core-api";
import { runAggregationAction } from "./actions";
import { TokenRatePanel } from "./TokenRatePanel";

export const dynamic = "force-dynamic";

export default async function TokenEconomyPage({
  searchParams,
}: {
  searchParams: { error?: string; ran?: string };
}): Promise<JSX.Element> {
  const [aggregates, overview, rateDetail] = await Promise.all([
    getDemandAggregates(),
    getTokenEconomyOverview(),
    getTokenRateDetail(),
  ]);

  return (
    <main className="page">
      <header className="pageHead">
        <p className="eyebrow">DataPay Portal · Ops</p>
        <h1>Token economy</h1>
        <p className="lede">
          Every token is equal: answering a question and buying through the platform earn the same
          kind. Tokens are earned, never sold — no one can buy them, and they carry no promised cash
          value. A 2% supplier fee on each confirmed delivery builds the reward pool DataPay shares
          back with the members who created that demand, as a discretionary reward for contribution
          rather than a return on a holding. Sharing isn't built yet, so the pool is currently only
          accumulating. Demand aggregates refresh hourly on their own; the button below triggers an
          extra run.
        </p>
      </header>

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
          <span className="tileLabel">Reward pool (accumulated)</span>
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

      <TokenRatePanel detail={rateDetail} />

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
