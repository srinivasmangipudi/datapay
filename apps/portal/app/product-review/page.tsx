import { reviewProductAction } from "./actions";
import { listOrdersForOps, listPendingProducts } from "./core-api";
import { OrdersPanel } from "./OrdersPanel";

export const dynamic = "force-dynamic";

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export default async function ProductReviewPage({
  searchParams,
}: {
  searchParams: { error?: string };
}): Promise<JSX.Element> {
  const [pending, orders] = await Promise.all([listPendingProducts(), listOrdersForOps()]);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Product review</h1>
      <p className="lede">
        Every organization-listed product — sheet-extracted or manually typed — lands here as a
        draft before it can ever reach a member's Products tab. Routine price/quantity syncs on an
        already-approved product don't come back through here; only genuinely new listings do.
      </p>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Action failed:</strong> {searchParams.error}
        </div>
      )}

      <section className="section">
        <h2>Awaiting review ({pending.length})</h2>
        {pending.length === 0 && <p className="empty">Nothing in the queue right now.</p>}
        {pending.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Organization</th>
                  <th>Unit</th>
                  <th>Market price</th>
                  <th>Sale price</th>
                  <th>Qty</th>
                  <th>Source</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url} alt={p.name_en} className="productThumb" />
                      )}
                      {p.name_en}
                    </td>
                    <td className="muted small">{p.organization_name}</td>
                    <td className="small">{p.unit_spec ?? <span className="muted">—</span>}</td>
                    <td className="num">{formatPaise(p.market_price_paise)}</td>
                    <td className="num value">{formatPaise(p.sale_price_paise)}</td>
                    <td className="num">{p.quantity_available}</td>
                    <td className="muted small">{p.source}</td>
                    <td className="actions">
                      <form action={reviewProductAction}>
                        <input type="hidden" name="productId" value={p.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <button type="submit" className="approveBtn">
                          Approve
                        </button>
                      </form>
                      <form action={reviewProductAction}>
                        <input type="hidden" name="productId" value={p.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <button type="submit" className="rejectBtn">
                          Reject
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
        <h2>Recent orders ({orders.length})</h2>
        <p className="lede">
          Identity-blind by design — a relay token, never a member's alias. Reveal delivery info
          here to relay it to the organization out-of-band (phone/WhatsApp), the same posture
          producer payouts already use for physical goods.
        </p>
        <OrdersPanel orders={orders} />
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `.productThumb { width: 32px; height: 32px; object-fit: cover; border-radius: 6px; margin-right: 8px; vertical-align: middle; }`,
        }}
      />
    </main>
  );
}
