"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveDeliveryInfo, reviewProduct } from "./core-api";

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
