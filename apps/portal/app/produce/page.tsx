import { listPayouts, listProduceListings } from "./core-api";
import { runMatchingAction, runPayoutBatchAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProducePage({
  searchParams,
}: {
  searchParams: { error?: string; matched?: string; paid?: string };
}): Promise<JSX.Element> {
  const [listings, payouts] = await Promise.all([listProduceListings(), listPayouts()]);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Produce &amp; payouts</h1>
      <p className="lede">
        Matching prefers the internal collective first (SPEC.md §18) before any external buyer.
        Payout batching pays every agreed/completed linkage not yet paid — low-trust producers are
        held for review, never auto-paid and never silently skipped.
      </p>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Action failed:</strong> {searchParams.error}
        </div>
      )}
      {searchParams.matched && <div className="successBanner">Matching run triggered.</div>}
      {searchParams.paid && <div className="successBanner">Payout batch run.</div>}

      <div className="actions">
        <form action={runPayoutBatchAction}>
          <button type="submit" className="submitBtn">
            Run payout batch now
          </button>
        </form>
      </div>

      <section className="section">
        <h2>Listings ({listings.length})</h2>
        {listings.length === 0 && <p className="empty">No listings yet.</p>}
        {listings.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Producer</th>
                  <th>Zone</th>
                  <th className="num">Qty</th>
                  <th>State</th>
                  <th>Linkages</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id}>
                    <td>{l.category_name}</td>
                    <td className="mono small">{l.alias_id.slice(0, 12)}…</td>
                    <td className="small">{l.zone_name ?? <span className="muted">—</span>}</td>
                    <td className="num">
                      {l.qty} {l.unit}
                    </td>
                    <td className="small">{l.state}</td>
                    <td className="small">
                      {l.linkage_count === "0" ? (
                        <span className="muted">None</span>
                      ) : (
                        `${l.linkage_count} — ${l.latest_linkage_state}`
                      )}
                    </td>
                    <td>
                      <form action={runMatchingAction}>
                        <input type="hidden" name="listingId" value={l.id} />
                        <button type="submit" className="linkBtn">
                          Run matching
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>Payouts ({payouts.length})</h2>
        {payouts.length === 0 && <p className="empty">No payouts run yet.</p>}
        {payouts.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Producer</th>
                  <th>Linkage</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th>UPI ref</th>
                  <th>Initiated</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="mono small">{p.alias_id.slice(0, 12)}…</td>
                    <td className="mono small">{p.linkage_id}</td>
                    <td className="num value">₹{(p.amount_paise / 100).toLocaleString()}</td>
                    <td className="small">{p.status}</td>
                    <td className="mono small">{p.upi_ref ?? <span className="muted">—</span>}</td>
                    <td className="muted small">{new Date(p.initiated_at).toLocaleString()}</td>
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
