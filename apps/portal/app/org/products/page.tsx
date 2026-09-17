import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listCategories } from "../core-api";
import { ImportSheetForm } from "./ImportSheetForm";
import { listImportRuns, listOwnOrders, listOwnProducts } from "./core-api";
import { ProductForm } from "./ProductForm";

export const dynamic = "force-dynamic";

const REVIEW_STATE_LABEL: Record<string, string> = {
  draft: "Awaiting review",
  approved: "Live",
  rejected: "Not approved",
};

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export default async function OrgProductsPage(): Promise<JSX.Element> {
  const token = cookies().get("org_session")?.value;
  if (!token) redirect("/org/login");

  const [categories, products, importRuns, orders] = await Promise.all([
    listCategories(),
    listOwnProducts(token),
    listImportRuns(token),
    listOwnOrders(token),
  ]);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Organization</p>
      <h1>Products</h1>
      <p className="lede">
        Point at a sheet to bulk-import your catalog, or add one product at a time. Every new
        listing goes into DataPay's review queue first — an ops reviewer approves it before it
        appears in a member's Products tab. Re-importing later just updates quantity/price on
        products you've already listed, never creates duplicates.
      </p>

      <ImportSheetForm recentRuns={importRuns} />
      <ProductForm categories={categories} />

      <section className="section">
        <h2>Your catalog ({products.length})</h2>
        {products.length === 0 && <p className="empty">Nothing listed yet.</p>}
        {products.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Unit</th>
                  <th>Market price</th>
                  <th>Sale price</th>
                  <th>Qty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url} alt={p.name_en} className="productThumb" />
                      )}
                      {p.name_en}
                    </td>
                    <td className="small">{p.unit_spec ?? <span className="muted">—</span>}</td>
                    <td className="num">{formatPaise(p.market_price_paise)}</td>
                    <td className="num value">{formatPaise(p.sale_price_paise)}</td>
                    <td className="num">{p.quantity_available}</td>
                    <td className="small">{REVIEW_STATE_LABEL[p.review_state] ?? p.review_state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>Orders ({orders.length})</h2>
        <p className="lede">
          Identity-blind by design — you'll see a relay reference here, never a member's identity;
          DataPay ops relays delivery details to you directly once an order is placed.
        </p>
        {orders.length === 0 && <p className="empty">No orders yet.</p>}
        {orders.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.name_en}</td>
                    <td className="num">{o.quantity}</td>
                    <td className="num">{formatPaise(o.unit_price_paise)}</td>
                    <td className="small">{o.status}</td>
                    <td className="muted small">{new Date(o.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `.productThumb { width: 32px; height: 32px; object-fit: cover; border-radius: 6px; margin-right: 8px; vertical-align: middle; }`,
        }}
      />
    </main>
  );
}
