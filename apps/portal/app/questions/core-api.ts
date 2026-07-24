import { apiFetch } from "../lib/core-api-client";

export type AnswerType = "single" | "multi" | "yesno" | "intent_window" | "numeric" | "free_text";

export interface CreateQuestionPayload {
  categoryId: number;
  textEn: string;
  textKn?: string;
  type: AnswerType;
  rewardTokens: number;
  options?: { labelEn: string; labelKn?: string }[];
  intentWindow?: "1m" | "3m" | "6m" | "12m";
  // Omit for a global question. Set to scope it to a zone and every zone
  // beneath it (SPEC.md §23) — e.g. a constituency-scoped question reaches
  // every village under it, never a sibling zone.
  zoneId?: string;
}

export interface RecentQuestion {
  id: number;
  category_id: number;
  type: AnswerType;
  text_en: string;
  text_kn: string | null;
  reward_tokens: number;
  source: string;
  review_state: string;
  active_from: string;
  zone_id: string | null;
  zone_name: string | null;
}

export function createQuestion(payload: CreateQuestionPayload) {
  return apiFetch("/v1/admin/questions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listRecentAdminQuestions(): Promise<RecentQuestion[]> {
  return apiFetch("/v1/admin/questions?source=admin_authored");
}

/**
 * Find-or-create by name (SPEC.md §26) — typing a brand-new category name
 * here creates it on the spot; typing an existing one resolves to the same
 * row, never a duplicate.
 */
export function resolveCategory(name: string): Promise<{ id: number; created: boolean }> {
  return apiFetch("/v1/admin/categories", { method: "POST", body: JSON.stringify({ name }) });
}

/**
 * A starting draft, never the system of record (SPEC.md §27) — the admin
 * reviews/edits the result before anything is saved.
 */
export function translateText(text: string, targetLang: "kn"): Promise<{ translated: string }> {
  return apiFetch("/v1/admin/translate", { method: "POST", body: JSON.stringify({ text, targetLang }) });
}
