import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listCategories } from "../core-api";
import { EditableProductRow } from "./EditableProductRow";
import { ImportSheetForm } from "./ImportSheetForm";
import { listImportRuns, listOwnOrders, listOwnProducts } from "./core-api";
import { ProductForm } from "./ProductForm";

export const dynamic = "force-dynamic";

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
        <strong>1. Import.</strong> Point at a public sheet to bulk-import your catalog, or add
        one product at a time. Every new listing goes into DataPay's review queue first — an ops
        reviewer approves it before it appears in a member's Products tab. Re-importing later just
        updates quantity/price on products you've already listed, never creates duplicates.
        <br />
        <strong>2. Review, edit, and save.</strong> Everything below is editable — fix a price or
        quantity and hit Save, whether it just came in from an import or you're updating stock on
        something already live.
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
                  <th>Market price (₹)</th>
                  <th>Sale price (₹)</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <EditableProductRow key={p.id} product={p} />
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
          __html: `
        .productThumb { width: 32px; height: 32px; object-fit: cover; border-radius: 6px; margin-right: 8px; vertical-align: middle; }
        .cellInput { border: 1px solid transparent; background: transparent; font: inherit; color: inherit; padding: 4px 6px; border-radius: 4px; width: 100%; }
        .cellInput:hover, .cellInput:focus { border-color: #d8d7cf; background: #fcfcfb; outline: none; }
        .cellInputSmall { width: 80px; }
      `,
        }}
      />
    </main>
  );
}
