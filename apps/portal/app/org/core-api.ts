import { apiFetch } from "../lib/core-api-client";

export type AnswerType = "single" | "multi" | "yesno" | "intent_window" | "numeric" | "free_text";

export interface OrgQuestionPayload {
  categoryId: number;
  textEn: string;
  type: AnswerType;
  rewardTokens: number;
  options?: { labelEn: string; labelKn?: string }[];
  intentWindow?: "1m" | "3m" | "6m" | "12m";
  allowPhoto: boolean;
  allowVoice: boolean;
}

export interface OwnQuestion {
  id: number;
  category_id: number;
  type: AnswerType;
  text_en: string;
  reward_tokens: number;
  review_state: "draft" | "approved" | "rejected";
  active_from: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  name_kn: string | null;
  sensitivity: string;
}

export function orgLogin(email: string, password: string): Promise<{ token: string; name: string }> {
  return apiFetch("/v1/org/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function submitOrgQuestion(token: string, payload: OrgQuestionPayload): Promise<{ id: number }> {
  return apiFetch("/v1/org/questions", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function listOwnQuestions(token: string): Promise<OwnQuestion[]> {
  return apiFetch("/v1/org/questions", { headers: { Authorization: `Bearer ${token}` } });
}

// Organizations pick from the existing category list rather than typing free
// text (unlike the ops wizard) — one less way a company account can leave
// stray/duplicate categories behind.
export function listCategories(): Promise<Category[]> {
  return apiFetch("/v1/admin/categories");
}
