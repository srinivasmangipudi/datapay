"use client";

import { useState, useTransition } from "react";
import type { Category } from "../core-api";
import { createProductAction, uploadPhotoAction } from "./actions";

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ProductForm({ categories }: { categories: Category[] }): JSX.Element {
  const [nameEn, setNameEn] = useState("");
  const [unitSpec, setUnitSpec] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [marketPrice, setMarketPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(await readAsBase64(file));
  }

  function reset() {
    setNameEn("");
    setUnitSpec("");
    setCategoryId("");
    setMarketPrice("");
    setSalePrice("");
    setQuantity("");
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const marketPricePaise = Math.round(Number(marketPrice) * 100);
    const salePricePaise = Math.round(Number(salePrice) * 100);
    const quantityAvailable = Number(quantity);
    if (!nameEn.trim() || !marketPricePaise || !salePricePaise || !Number.isFinite(quantityAvailable)) {
      setMessage({ kind: "error", text: "Fill in a name, both prices, and a quantity." });
      return;
    }

    startTransition(() => {
      void (async () => {
        const result = await createProductAction({
          nameEn: nameEn.trim(),
          unitSpec: unitSpec.trim() || undefined,
          categoryId: categoryId === "" ? undefined : categoryId,
          marketPricePaise,
          salePricePaise,
          quantityAvailable,
        });
        if (!result.ok) {
          setMessage({ kind: "error", text: result.message });
          return;
        }
        if (photoFile) {
          const base64 = await readAsBase64(photoFile);
          const photoResult = await uploadPhotoAction(result.data.id, base64);
          if (!photoResult.ok) {
            setMessage({ kind: "error", text: `Product created, but photo upload failed: ${photoResult.message}` });
            reset();
            return;
          }
        }
        setMessage({ kind: "ok", text: "Added — it's now awaiting review." });
        reset();
      })();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="step">
      <span className="stepLabel">Add a product by hand</span>
      {message && (
        <div className={message.kind === "ok" ? "successBanner" : "errorBanner"}>{message.text}</div>
      )}

      <input placeholder="Product name" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
      <input placeholder="Unit (e.g. 1kg, 500ml)" value={unitSpec} onChange={(e) => setUnitSpec(e.target.value)} />
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}>
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        placeholder="Market price (₹)"
        value={marketPrice}
        onChange={(e) => setMarketPrice(e.target.value)}
      />
      <input
        type="number"
        placeholder="Sale price (₹)"
        value={salePrice}
        onChange={(e) => setSalePrice(e.target.value)}
      />
      <input
        type="number"
        placeholder="Quantity available"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />

      <label className="hint" style={{ display: "block", marginTop: 8 }}>
        Photo (optional)
        <input type="file" accept="image/*" onChange={handlePhotoChange} />
      </label>
      {photoPreview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoPreview} alt="Preview" className="productThumbLarge" />
      )}

      <button type="submit" className="submitBtn" disabled={isPending}>
        {isPending ? "Saving…" : "Add product"}
      </button>
      <p className="hint">Goes into review — an ops reviewer approves it before members see it.</p>

      <style
        dangerouslySetInnerHTML={{
          __html: `.productThumbLarge { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-top: 8px; display: block; }`,
        }}
      />
    </form>
  );
}
