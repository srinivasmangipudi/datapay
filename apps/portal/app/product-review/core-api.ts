import { apiFetch } from "../lib/core-api-client";

export interface PendingProduct {
  id: number;
  organization_id: string;
  organization_name: string;
  category_id: number | null;
  name_en: string;
  name_kn: string | null;
  description_en: string | null;
  unit_spec: string | null;
  market_price_paise: number;
  sale_price_paise: number;
  quantity_available: number;
  photo_url: string | null;
  source: string;
  review_state: string;
  zone_id: string | null;
}

export interface OpsOrder {
  id: number;
  name_en: string;
  organization_name: string;
  quantity: number;
  relay_token: string;
  status: string;
  created_at: string;
}

export function listPendingProducts(): Promise<PendingProduct[]> {
  return apiFetch("/v1/admin/org-products/pending");
}

export function reviewProduct(productId: number, decision: "approve" | "reject") {
  return apiFetch(`/v1/admin/org-products/${productId}/${decision}`, { method: "POST" });
}

export function listOrdersForOps(): Promise<OpsOrder[]> {
  return apiFetch("/v1/admin/org-products/orders");
}

// Ops-mediated fulfillment (SPEC.md §7-style identity-blind relay) — the org
// never resolves this itself, only ops, to relay delivery info out-of-band.
export function resolveDeliveryInfo(relayToken: string): Promise<{ address: string; zoneHint: string | null }> {
  return apiFetch("/v1/relay/resolve", {
    method: "POST",
    body: JSON.stringify({ relayToken }),
  });
}
