import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOwnProfile, listCategories } from "../core-api";
import { ImportSheetForm } from "./ImportSheetForm";
import { listImportRuns, listOwnOrders, listOwnProducts } from "./core-api";
import { ProductCard } from "./ProductCard";
import { ProductForm } from "./ProductForm";

export const dynamic = "force-dynamic";

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export default async function OrgProductsPage(): Promise<JSX.Element> {
  const token = cookies().get("org_session")?.value;
  if (!token) redirect("/org/login");

  const [profile, categories, products, importRuns, orders] = await Promise.all([
    getOwnProfile(token),
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
        <strong>2. Review, edit, and save.</strong> Everything below is editable — fix a price,
        write a real description, add a photo, and hit Save. This is exactly what a member — or
        anyone visiting{" "}
        <a href={`/store/${profile.slug}`} target="_blank" rel="noreferrer">
          your public catalog page
        </a>{" "}
        — will see.
      </p>

      <ImportSheetForm recentRuns={importRuns} />
      <ProductForm categories={categories} />

      <section className="section">
        <h2>Your catalog ({products.length})</h2>
        {products.length === 0 && <p className="empty">Nothing listed yet.</p>}
        {products.length > 0 && (
          <div className="productGrid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} categories={categories} />
            ))}
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
        .cellInput { border: 1px solid #e7e4dc; background: #fff; font: inherit; color: inherit; padding: 6px 8px; border-radius: 6px; width: 100%; }
        .cellInput:hover, .cellInput:focus { border-color: #b9b6ab; outline: none; }

        .productGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
        .productCard { border: 1px solid #e7e4dc; border-radius: 14px; background: #fff; overflow: hidden; display: flex; flex-direction: column; }
        .productCardPhoto {
          position: relative; width: 100%; aspect-ratio: 4 / 3; background: #f6f5f1;
          display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden;
        }
        .productCardPhoto img { width: 100%; height: 100%; object-fit: cover; }
        .productCardPhotoPlaceholder { font-size: 13px; color: #8a939b; font-weight: 600; }
        .productCardPhotoOverlay {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          background: rgba(16, 20, 24, 0.55); color: #fff; font-size: 13px; font-weight: 600;
        }
        .productCardPhotoInput { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .productCardBody { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .productCardTopRow { display: flex; align-items: center; gap: 8px; }
        .productCardName { font-weight: 700; font-size: 14.5px; }
        .statusPill { font-size: 11px; font-weight: 700; color: #5b6672; white-space: nowrap; }
        .productCardDescription { resize: vertical; min-height: 44px; font-size: 13px; line-height: 1.5; }
        .productCardFieldsRow { display: flex; gap: 8px; }
        .productCardField { flex: 1; display: flex; flex-direction: column; gap: 3px; font-size: 11px; font-weight: 600; color: #5b6672; }
        .productCardActions { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
      `,
        }}
      />
    </main>
  );
}
