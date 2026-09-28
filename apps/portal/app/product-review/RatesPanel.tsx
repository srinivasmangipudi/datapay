import { DEFAULT_PLATFORM_FEE_BPS, DEFAULT_TOKEN_REWARD_BPS } from "@datapay/shared";
import { setProductRatesAction } from "./actions";
import type { ProductRates } from "./core-api";

function bpsToPct(bps: number | null): string {
  return bps === null ? "" : (bps / 100).toString();
}

/** What a buyer actually earns on one unit at the effective rate — the number
    that makes an abstract percentage concrete while ops is setting it. */
function tokensPerUnit(salePricePaise: number, bps: number | null): number {
  const rate = bps ?? DEFAULT_TOKEN_REWARD_BPS;
  return Math.round((salePricePaise * rate) / 10000 / 100);
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
        {(DEFAULT_TOKEN_REWARD_BPS / 100).toFixed(2)}% reward,{" "}
        {(DEFAULT_PLATFORM_FEE_BPS / 100).toFixed(2)}% fee); enter <strong>0</strong> for an
        explicit none on that product.
      </p>

      {products.length === 0 && <p className="empty">No products yet.</p>}

      {products.length > 0 && (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Organization</th>
                <th className="num">Price</th>
                <th className="num">Reward %</th>
                <th className="num">Fee %</th>
                <th className="num">Tokens / unit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name_en}
                    {p.review_state !== "approved" && (
                      <span className="muted small"> · {p.review_state}</span>
                    )}
                  </td>
                  <td className="small muted">{p.organization_name}</td>
                  <td className="num value">₹{(p.sale_price_paise / 100).toLocaleString("en-IN")}</td>
                  <td colSpan={4}>
                    <form action={setProductRatesAction} className="ratesForm">
                      <input type="hidden" name="productId" value={p.id} />
                      <input
                        type="number"
                        name="tokenRewardPct"
                        step="0.01"
                        min="0"
                        max="100"
                        defaultValue={bpsToPct(p.token_reward_bps)}
                        placeholder={(DEFAULT_TOKEN_REWARD_BPS / 100).toFixed(2)}
                        aria-label={`Token reward percent for ${p.name_en}`}
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
                      <span className="num small muted">
                        {tokensPerUnit(p.sale_price_paise, p.token_reward_bps)}
                      </span>
                      <button type="submit" className="linkBtn">
                        Save
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
