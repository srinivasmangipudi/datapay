import { apiFetch } from "../lib/core-api-client";

export interface DraftQuestion {
  id: number;
  category_id: number;
  type: string;
  text_en: string;
  text_kn: string | null;
  reward_tokens: number;
  source: string;
  generation_run_id: number | null;
  review_state: string;
  zone_id: string | null;
  zone_name: string | null;
}

export function listDraftQuestions(): Promise<DraftQuestion[]> {
  return apiFetch(`/v1/admin/questions?review_state=draft`);
}

export function reviewQuestion(questionId: number, decision: "approve" | "reject") {
  return apiFetch(`/v1/admin/questions/${questionId}/${decision}`, { method: "POST" });
}
