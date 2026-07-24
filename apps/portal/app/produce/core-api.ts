import { apiFetch } from "../lib/core-api-client";

export interface ProduceListing {
  id: number;
  alias_id: string;
  qty: string;
  unit: string;
  state: string;
  asking_price_paise: number | null;
  created_at: string;
  category_name: string;
  zone_id: string | null;
  zone_name: string | null;
  linkage_count: string;
  latest_linkage_state: string | null;
}

export interface ProducerPayout {
  id: number;
  alias_id: string;
  linkage_id: number;
  amount_paise: number;
  status: string;
  upi_ref: string | null;
  batch_id: string | null;
  initiated_at: string;
}

export function listProduceListings(state?: string): Promise<ProduceListing[]> {
  return apiFetch(`/v1/admin/produce-listings${state ? `?state=${encodeURIComponent(state)}` : ""}`);
}

export function listPayouts(): Promise<ProducerPayout[]> {
  return apiFetch("/v1/admin/producer-payouts");
}

export function runMatching(listingId: number) {
  return apiFetch(`/v1/admin/produce-matching/run/${listingId}`, { method: "POST" });
}

export function runPayoutBatch() {
  return apiFetch("/v1/admin/producer-payouts/run", { method: "POST" });
}
