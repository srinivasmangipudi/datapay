import { apiFetch } from "../lib/core-api-client";

export type AnswerType = "single" | "multi" | "yesno" | "intent_window" | "numeric" | "free_text";

/** What the API expects — a category already resolved to an id. */
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

/** What the form sends — a category NAME, resolved (or created) server-side. */
export type OrgQuestionFormPayload = Omit<OrgQuestionPayload, "categoryId"> & {
  categoryName: string;
};

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

// Self-serve — lands inactive pending ops approval (/organizations page).
export function signupOrg(name: string, email: string, password: string): Promise<{ id: string; slug: string }> {
  return apiFetch("/v1/org/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });
}

export function getOwnProfile(token: string): Promise<{ name: string; slug: string }> {
  return apiFetch("/v1/org/me", { headers: { Authorization: `Bearer ${token}` } });
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

// Org-scoped, not the /v1/admin/* route this used to call — a company-facing
// page shouldn't reach into an ops surface just because admin routes happen
// to be unauthenticated today.
export function listCategories(token: string): Promise<Category[]> {
  return apiFetch("/v1/org/categories", { headers: { Authorization: `Bearer ${token}` } });
}

/**
 * Find-or-create by slug. Orgs used to be limited to a fixed dropdown to
 * avoid stray duplicates; typing is allowed now, and the duplicate problem is
 * handled where it actually can be — "Solar Lights", "solar lights" and
 * "Solar  Lights" all slugify to `solar-lights` and resolve to one row.
 */
export function resolveCategory(token: string, name: string): Promise<{ id: number; created: boolean }> {
  return apiFetch("/v1/org/categories", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
}
