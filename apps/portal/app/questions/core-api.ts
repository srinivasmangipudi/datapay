import { apiFetch } from "../lib/core-api-client";

export type AnswerType = "single" | "multi" | "yesno" | "intent_window" | "numeric";

export interface CreateQuestionPayload {
  categoryId: number;
  textEn: string;
  textKn?: string;
  type: AnswerType;
  rewardTokens: number;
  options?: { labelEn: string; labelKn?: string }[];
  intentWindow?: "1m" | "3m" | "6m" | "12m";
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
