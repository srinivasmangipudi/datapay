// This page is public (SPEC.md §29) — it still goes through Core API rather
// than a direct DB read, same §10 discipline as every other portal page,
// just hitting a genuinely-unauthenticated endpoint instead of an
// admin one.
import { apiFetch } from "../lib/core-api-client";

export interface RegistryRow {
  id: number;
  category_name: string;
  zone_name: string;
  zone_level: string;
  cohort_size: number;
  computed_at: string;
}

export type Distribution =
  | {
      kind: "options";
      total: number;
      options: Array<{ label: string; count: number; pct: number }>;
    }
  | { kind: "numeric"; count: number; mean: number; median: number; min: number; max: number };

export interface PublishedQuestion {
  question_id: number;
  text: string;
  type: string;
  cohort_size: number;
  distribution: Distribution;
  computed_at: string;
}

/** One category × zone card — the unit both buckets are made of. */
export interface DemandGroup {
  category_id: number;
  category_slug: string;
  category_name: string;
  zone_id: string;
  zone_name: string;
  zone_level: string;
  households: number;
  intending: number | null;
  has_open_offer: boolean;
  questions: PublishedQuestion[];
}

export interface RegistryMeta {
  k_anon_floor: number;
  relaxed_floor: boolean;
  production_floor: number;
  generated_at: string;
}

export interface RegistryResponse {
  registry: RegistryRow[];
  opportunities: RegistryRow[];
  /** Bucket one — categories that are things to buy and sell. */
  products: DemandGroup[];
  /** Bucket two — everything else members are asked about. */
  topics: DemandGroup[];
  meta: RegistryMeta;
}

export function getRegistry(): Promise<RegistryResponse> {
  return apiFetch("/v1/public/registry");
}
