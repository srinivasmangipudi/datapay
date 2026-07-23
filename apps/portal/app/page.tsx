// §10 boundary: this app, and every route added under it, may only ever query
// demand_aggregates / offers / linkages via the portal's restricted DB role.
// It must have no code path to responses, snaps, members, or Vault.
import { getDemandAggregates, getTokenRateHistory } from "./data";
import { TokenRateChart } from "./TokenRateChart";

export const dynamic = "force-dynamic"; // ops dashboard — always current, never cached

export default async function PortalHome(): Promise<JSX.Element> {
  const [tokenRateHistory, aggregates] = await Promise.all([
    getTokenRateHistory(),
    getDemandAggregates(),
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
      <p className="navLink">
        <a href="/questions">New question →</a> · <a href="/intelligence">Area intelligence &amp; question review →</a>
      </p>

      <div className="tiles">
        <div className="tile">
          <span className="tileLabel">Current token rate</span>
          <span className="tileValue">
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

      {/* dangerouslySetInnerHTML — see layout.tsx for why a plain <style>{`...`}</style>
          with a quoted value inside causes a hydration mismatch. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .page { max-width: 880px; margin: 0 auto; padding: 48px 24px 80px; }
        .eyebrow { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #2a78d6; font-weight: 700; margin: 0 0 8px; }
        h1 { font-size: 1.8rem; margin: 0 0 12px; }
        .lede { color: #52514e; max-width: 62ch; margin: 0 0 12px; font-size: 14px; line-height: 1.6; }
        .navLink { margin: 0 0 32px; }
        .navLink a { color: #2a78d6; font-size: 13.5px; font-weight: 600; text-decoration: none; }
        .navLink a:hover { text-decoration: underline; }
        .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e1e0d9; border: 1px solid #e1e0d9; border-radius: 6px; overflow: hidden; margin-bottom: 40px; }
        .tile { background: #fcfcfb; padding: 18px 20px; display: flex; flex-direction: column; gap: 8px; }
        .tileLabel { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #898781; }
        .tileValue { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .tileValue.small { font-size: 13px; font-weight: 500; }
        .section { margin-bottom: 44px; }
        .section h2 { font-size: 1.1rem; margin: 0 0 16px; }
        .tableWrap { overflow-x: auto; border: 1px solid #e1e0d9; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        th { text-align: left; padding: 10px 14px; background: #f9f9f7; color: #52514e; font-weight: 600; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e1e0d9; }
        td { padding: 10px 14px; border-bottom: 1px solid #e1e0d9; }
        tr:last-child td { border-bottom: none; }
        td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
        td.level { text-transform: capitalize; color: #52514e; }
        td.muted { color: #898781; }
        .empty { color: #898781; font-size: 13px; }
        @media (prefers-color-scheme: dark) {
          .lede { color: #c3c2b7; }
          .tiles { background: #2c2c2a; border-color: #2c2c2a; }
          .tile { background: #1a1a19; }
          .tileLabel { color: #898781; }
          .tableWrap { border-color: #2c2c2a; }
          th { background: #14161b; color: #c3c2b7; border-bottom-color: #2c2c2a; }
          td { border-bottom-color: #2c2c2a; }
          td.level { color: #c3c2b7; }
        }
      `,
        }}
      />
    </main>
  );
}
