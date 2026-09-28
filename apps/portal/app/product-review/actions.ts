"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveDeliveryInfo, reviewProduct, setProductDelisted, setProductRates } from "./core-api";

export async function reviewProductAction(formData: FormData): Promise<void> {
  const productId = Number(formData.get("productId"));
  const decision = String(formData.get("decision")) as "approve" | "reject";

  try {
    await reviewProduct(productId, decision);
  } catch (err) {
    revalidatePath("/product-review");
    redirect(`/product-review?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/product-review");
  redirect("/product-review");
}

/**
 * An empty input means "use the platform default" and sends null; a typed 0
 * means "no reward on this product" and sends 0. Those are different states,
 * so the empty string is NOT coerced to a number here — Number("") is 0, which
 * would silently turn "clear this override" into "set it to zero".
 */
export async function setProductRatesAction(formData: FormData): Promise<void> {
  const productId = Number(formData.get("productId"));
  // Percent in the UI, basis points on the wire (the supplier fee).
  const rawPct = (name: string): number | null | undefined => {
    const v = formData.get(name);
    if (v === null) return undefined;
    const s = String(v).trim();
    if (s === "") return null;
    const pct = Number(s);
    if (!Number.isFinite(pct)) return undefined;
    return Math.round(pct * 100);
  };

  // A plain token count — no unit conversion, it is the number ops typed.
  const rawInt = (name: string): number | null | undefined => {
    const v = formData.get(name);
    if (v === null) return undefined;
    const s = String(v).trim();
    if (s === "") return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return undefined;
    return Math.round(n);
  };

  try {
    await setProductRates(productId, {
      purchaseRewardTokens: rawInt("purchaseRewardTokens"),
      platformFeeBps: rawPct("platformFeePct"),
    });
  } catch (err) {
    revalidatePath("/product-review");
    redirect(`/product-review?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/product-review");
  redirect("/product-review?rates=saved");
}

export async function setProductDelistedAction(formData: FormData): Promise<void> {
  const productId = Number(formData.get("productId"));
  const delisted = String(formData.get("delisted")) === "true";
  const reason = String(formData.get("reason") ?? "").trim();

  try {
    await setProductDelisted(productId, delisted, reason || undefined);
  } catch (err) {
    revalidatePath("/product-review");
    redirect(`/product-review?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/product-review");
  redirect(`/product-review?listing=${delisted ? "removed" : "restored"}`);
}

// Called directly from a client component (not a <form> submit) — the
// revealed address should live only in the browser's in-memory React state
// for this one session, never in a URL/query param where it could linger in
// history or server logs.
export async function revealDeliveryInfoAction(
  relayToken: string
): Promise<{ ok: true; address: string; zoneHint: string | null } | { ok: false; message: string }> {
  try {
    const result = await resolveDeliveryInfo(relayToken);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
