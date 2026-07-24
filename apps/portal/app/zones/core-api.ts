import { apiFetch } from "../lib/core-api-client";

export interface CreateZonePayload {
  name: string;
  nameKn?: string;
  level: "village" | "panchayat" | "hobli" | "constituency";
  parentId?: string;
}

export interface CreateCategoryPayload {
  slug: string;
  name: string;
  nameKn?: string;
  sensitivity?: "standard" | "none";
}

export function createZone(payload: CreateZonePayload) {
  return apiFetch("/v1/admin/zones", { method: "POST", body: JSON.stringify(payload) });
}

export function createCategory(payload: CreateCategoryPayload) {
  return apiFetch("/v1/admin/categories", { method: "POST", body: JSON.stringify(payload) });
}
