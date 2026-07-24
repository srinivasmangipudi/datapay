import { listQualityFlags, listTrustScores } from "./core-api";

export const dynamic = "force-dynamic";

export default async function AuditPage(): Promise<JSX.Element> {
  const [flags, trustScores] = await Promise.all([listQualityFlags(), listTrustScores()]);
  const lowTrust = trustScores.filter((t) => Number(t.trust_score) < 0.5);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Audit &amp; fraud</h1>
      <p className="lede">
        Every real-money movement (tokens, fund ledger, producer payouts) is exportable as one CSV.
        Quality flags and trust scores are alias-only, same as everywhere else in core_db — LAW 1
        holds here too.
      </p>

      <div className="actions">
        <a href="/audit/export" className="submitBtn" style={{ textDecoration: "none", display: "inline-block" }}>
          Download ledger CSV
        </a>
      </div>

      <section className="section">
        <h2>
          Low-trust members ({lowTrust.length} below 0.5)
        </h2>
        {trustScores.length === 0 && <p className="empty">No members yet.</p>}
        {trustScores.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Alias</th>
                  <th className="num">Trust score</th>
                  <th className="num">Flags</th>
                </tr>
              </thead>
              <tbody>
                {trustScores.slice(0, 25).map((t) => (
                  <tr key={t.alias_id}>
                    <td>{t.display_alias}</td>
                    <td className="num">{Number(t.trust_score).toFixed(2)}</td>
                    <td className="num">{t.flag_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Showing the 25 lowest-trust members (sorted ascending).</p>
      </section>

      <section className="section">
        <h2>Recent quality flags ({flags.length})</h2>
        {flags.length === 0 && <p className="empty">No flags raised yet.</p>}
        {flags.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Alias</th>
                  <th>Rule</th>
                  <th>Detail</th>
                  <th>At</th>
                </tr>
              </thead>
              <tbody>
                {flags.slice(0, 50).map((f) => (
                  <tr key={f.id}>
                    <td className="mono small">{f.alias_id.slice(0, 12)}…</td>
                    <td className="small">{f.rule}</td>
                    <td className="small">{f.detail}</td>
                    <td className="muted small">{new Date(f.at).toLocaleString()}</td>
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
