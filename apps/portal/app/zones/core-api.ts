import { apiFetch } from "../lib/core-api-client";

export interface CreateZonePayload {
  name: string;
  nameKn?: string;
  level: "village" | "panchayat" | "hobli" | "constituency";
  parentId?: string;
  centroidLat?: number;
  centroidLng?: number;
  languageCode?: string;
}

export interface UpdateZoneCentroidPayload {
  centroidLat: number;
  centroidLng: number;
}

export interface UpdateZoneLanguagePayload {
  languageCode: string;
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

export function updateZoneCentroid(id: string, payload: UpdateZoneCentroidPayload) {
  return apiFetch(`/v1/admin/zones/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

// SPEC.md §39 — sets/corrects a zone's language, e.g. a manually-created
// zone or one geocoded before this addendum existed (no language_code yet).
export function updateZoneLanguage(id: string, payload: UpdateZoneLanguagePayload) {
  return apiFetch(`/v1/admin/zones/${id}/language`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function createCategory(payload: CreateCategoryPayload) {
  return apiFetch("/v1/admin/categories", { method: "POST", body: JSON.stringify(payload) });
}
