"use client";

import { useRef, useState, useTransition } from "react";
import type { Category } from "../core-api";
import { uploadPhotoAction, updateProductAction } from "./actions";
import type { OrgProduct } from "./core-api";

const REVIEW_STATE_LABEL: Record<string, string> = {
  draft: "Awaiting review",
  approved: "Live",
  rejected: "Not approved",
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// One product per card, showing (and letting an org edit) the same detail a
// member would actually see: photo, description, category — not just the
// bare name/price/qty a table row had room for.
export function ProductCard({
  product,
  categories,
}: {
  product: OrgProduct;
  categories: Category[];
}): JSX.Element {
  const [nameEn, setNameEn] = useState(product.name_en);
  const [descriptionEn, setDescriptionEn] = useState(product.description_en ?? "");
  const [categoryId, setCategoryId] = useState(product.category_id ? String(product.category_id) : "");
  const [unitSpec, setUnitSpec] = useState(product.unit_spec ?? "");
  const [marketPrice, setMarketPrice] = useState((product.market_price_paise / 100).toFixed(2));
  const [salePrice, setSalePrice] = useState((product.sale_price_paise / 100).toFixed(2));
  const [quantity, setQuantity] = useState(String(product.quantity_available));
  const [photoUrl, setPhotoUrl] = useState(product.photo_url);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function save() {
    setStatus("idle");
    setErrorMessage(null);
    startTransition(() => {
      void (async () => {
        const result = await updateProductAction(product.id, {
          nameEn: nameEn.trim(),
          descriptionEn: descriptionEn.trim() || undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
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

  function onPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    void (async () => {
      try {
        const imageBase64 = await fileToBase64(file);
        const result = await uploadPhotoAction(product.id, imageBase64);
        if (result.ok) {
          setPhotoUrl(result.data.photoUrl);
        } else {
          setErrorMessage(result.message);
        }
      } finally {
        setPhotoUploading(false);
      }
    })();
  }

  return (
    <div className="productCard">
      <div className="productCardPhoto" onClick={() => fileInputRef.current?.click()}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={nameEn} />
        ) : (
          <span className="productCardPhotoPlaceholder">Add photo</span>
        )}
        {photoUploading && <span className="productCardPhotoOverlay">Uploading…</span>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onPhotoChosen}
          className="productCardPhotoInput"
        />
      </div>

      <div className="productCardBody">
        <div className="productCardTopRow">
          <input className="cellInput productCardName" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          <span className="statusPill">{REVIEW_STATE_LABEL[product.review_state] ?? product.review_state}</span>
        </div>

        <textarea
          className="cellInput productCardDescription"
          placeholder="Description — shown to members exactly like this"
          value={descriptionEn}
          onChange={(e) => setDescriptionEn(e.target.value)}
          rows={2}
        />

        <div className="productCardFieldsRow">
          <label className="productCardField">
            <span>Category</span>
            <select className="cellInput" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="productCardField">
            <span>Unit</span>
            <input className="cellInput" value={unitSpec} onChange={(e) => setUnitSpec(e.target.value)} />
          </label>
        </div>

        <div className="productCardFieldsRow">
          <label className="productCardField">
            <span>Market ₹</span>
            <input
              className="cellInput num"
              type="number"
              value={marketPrice}
              onChange={(e) => setMarketPrice(e.target.value)}
            />
          </label>
          <label className="productCardField">
            <span>Sale ₹</span>
            <input
              className="cellInput num"
              type="number"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
          </label>
          <label className="productCardField">
            <span>Qty</span>
            <input
              className="cellInput num"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
        </div>

        <div className="productCardActions">
          <button type="button" className="submitBtn" disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save"}
          </button>
          {status === "saved" && <span className="successBanner small">Saved</span>}
          {status === "error" && <span className="errorBanner small">{errorMessage}</span>}
        </div>
      </div>
    </div>
  );
}
