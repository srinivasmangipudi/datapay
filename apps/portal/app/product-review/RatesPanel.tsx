import { DEFAULT_PLATFORM_FEE_BPS, DEFAULT_PURCHASE_REWARD_TOKENS } from "@datapay/shared";
import { setProductDelistedAction, setProductRatesAction } from "./actions";
import type { ProductRates } from "./core-api";

function bpsToPct(bps: number | null): string {
  return bps === null ? "" : (bps / 100).toString();
}

export function RatesPanel({ products }: { products: ProductRates[] }): JSX.Element {
  return (
    <section className="section">
      <div className="sectionHead">
        <h2>Purchase rates ({products.length})</h2>
      </div>
      <p className="lede">
        Ops-only — an organization sets its own prices and stock, never what the platform charges it
        or pays out in rewards. Leave a field <strong>empty</strong> to use the platform default (
        {DEFAULT_PURCHASE_REWARD_TOKENS} token per order,{" "}
        {(DEFAULT_PLATFORM_FEE_BPS / 100).toFixed(2)}% fee); enter <strong>0</strong> for an
        explicit none on that product. The buyer reward is a flat count per order, deliberately not
        a share of what was spent — see the token-economy page.
      </p>

      {products.length === 0 && <p className="empty">No products yet.</p>}

      {products.length > 0 && (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th className="num">ID</th>
                <th>Product</th>
                <th>Organization</th>
                <th className="num">Price</th>
                <th className="num">Tokens / order</th>
                <th className="num">Fee %</th>
                <th>Listing</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="num mono small muted">{p.id}</td>
                  <td>
                    {/* Thumb + id, because "Test Rice" and "Test Rice 5kg" are
                        impossible to tell apart from a name alone once a
                        catalog has more than a handful of rows. */}
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo_url} alt={p.name_en} className="productThumb" />
                    ) : (
                      <span className="productThumbEmpty" aria-hidden="true" />
                    )}
                    {p.name_en}
                    {p.sku && <span className="muted small mono"> · {p.sku}</span>}
                    {p.unit_spec && <span className="muted small"> · {p.unit_spec}</span>}
                    {p.review_state !== "approved" && (
                      <span className="muted small"> · {p.review_state}</span>
                    )}
                    {p.delisted_at && (
                      <span className="delistedTag" title={p.delisted_reason ?? undefined}>
                        removed from marketplace
                      </span>
                    )}
                  </td>
                  <td className="small muted">{p.organization_name}</td>
                  <td className="num value">₹{(p.sale_price_paise / 100).toLocaleString("en-IN")}</td>
                  <td colSpan={3}>
                    <form action={setProductRatesAction} className="ratesForm">
                      <input type="hidden" name="productId" value={p.id} />
                      <input
                        type="number"
                        name="purchaseRewardTokens"
                        step="1"
                        min="0"
                        max="1000"
                        defaultValue={p.purchase_reward_tokens ?? ""}
                        placeholder={String(DEFAULT_PURCHASE_REWARD_TOKENS)}
                        aria-label={`Tokens earned per order for ${p.name_en}`}
                      />
                      <input
                        type="number"
                        name="platformFeePct"
                        step="0.01"
                        min="0"
                        max="100"
                        defaultValue={bpsToPct(p.platform_fee_bps)}
                        placeholder={(DEFAULT_PLATFORM_FEE_BPS / 100).toFixed(2)}
                        aria-label={`Platform fee percent for ${p.name_en}`}
                      />
                      <button type="submit" className="linkBtn">
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="actions">
                    {/* Ops has the last word on what members see. Independent of
                        review state, so an org restocking can't undo it. */}
                    <form action={setProductDelistedAction}>
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="delisted" value={p.delisted_at ? "false" : "true"} />
                      {!p.delisted_at && (
                        <input name="reason" placeholder="Reason (optional)" className="reasonInput" />
                      )}
                      <button type="submit" className={p.delisted_at ? "approveBtn" : "rejectBtn"}>
                        {p.delisted_at ? "Relist" : "Remove"}
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
  );
}
