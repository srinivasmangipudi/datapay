"use client";

import { useState, useTransition } from "react";
import { updateProductAction } from "./actions";
import type { OrgProduct } from "./core-api";

const REVIEW_STATE_LABEL: Record<string, string> = {
  draft: "Awaiting review",
  approved: "Live",
  rejected: "Not approved",
};

export function EditableProductRow({ product }: { product: OrgProduct }): JSX.Element {
  const [nameEn, setNameEn] = useState(product.name_en);
  const [unitSpec, setUnitSpec] = useState(product.unit_spec ?? "");
  const [marketPrice, setMarketPrice] = useState((product.market_price_paise / 100).toFixed(2));
  const [salePrice, setSalePrice] = useState((product.sale_price_paise / 100).toFixed(2));
  const [quantity, setQuantity] = useState(String(product.quantity_available));
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setStatus("idle");
    setErrorMessage(null);
    startTransition(() => {
      void (async () => {
        const result = await updateProductAction(product.id, {
          nameEn: nameEn.trim(),
          unitSpec: unitSpec.trim() || undefined,
          marketPricePaise: Math.round(Number(marketPrice) * 100),
          salePricePaise: Math.round(Number(salePrice) * 100),
          quantityAvailable: Number(quantity),
        });
        if (result.ok) {
          setStatus("saved");
        } else {
          setStatus("error");
          setErrorMessage(result.message);
        }
      })();
    });
  }

  return (
    <tr>
      <td>
        {product.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.photo_url} alt={nameEn} className="productThumb" />
        )}
        <input className="cellInput" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
      </td>
      <td>
        <input className="cellInput cellInputSmall" value={unitSpec} onChange={(e) => setUnitSpec(e.target.value)} />
      </td>
      <td>
        <input
          className="cellInput cellInputSmall num"
          type="number"
          value={marketPrice}
          onChange={(e) => setMarketPrice(e.target.value)}
        />
      </td>
      <td>
        <input
          className="cellInput cellInputSmall num"
          type="number"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
        />
      </td>
      <td>
        <input
          className="cellInput cellInputSmall num"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </td>
      <td className="small">{REVIEW_STATE_LABEL[product.review_state] ?? product.review_state}</td>
      <td className="actions">
        <button type="button" className="submitBtn" disabled={isPending} onClick={save}>
          {isPending ? "Saving…" : "Save"}
        </button>
        {status === "saved" && <div className="successBanner small">Saved</div>}
        {status === "error" && <div className="errorBanner small">{errorMessage}</div>}
      </td>
    </tr>
  );
}
