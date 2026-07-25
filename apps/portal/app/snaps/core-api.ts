import { apiFetch } from "../lib/core-api-client";

export interface AdminSnap {
  id: number;
  aliasId: string;
  state: string;
  storageKey: string;
  categoryId: number | null;
  rewardTokens: number;
  capturedAt: string;
  productCode: string | null;
  recognizedTags: string[];
  recognizedLabel: string | null;
  recognizedConfidence: number | null;
  recognizedProductGuess: string | null;
  recognizedCategoryName: string | null;
}

export function listSnaps(state?: string): Promise<AdminSnap[]> {
  return apiFetch(`/v1/admin/snaps${state ? `?state=${encodeURIComponent(state)}` : ""}`);
}

export function verifySnap(id: number) {
  return apiFetch(`/v1/admin/snaps/${id}/verify`, { method: "POST" });
}

export function rejectSnap(id: number) {
  return apiFetch(`/v1/admin/snaps/${id}/reject`, { method: "POST" });
}
