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

export interface RegistryResponse {
  registry: RegistryRow[];
  opportunities: RegistryRow[];
}

export function getRegistry(): Promise<RegistryResponse> {
  return apiFetch("/v1/public/registry");
}
