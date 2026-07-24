import { apiFetch } from "../lib/core-api-client";

export type GeneratorKind = "template" | "document_grounded";

export interface CreateTopicPayload {
  slug: string;
  name: string;
  categoryId: number;
  generatorKind: GeneratorKind;
  config: Record<string, unknown>;
  scheduleCron?: string;
  zoneId?: string;
}

export interface AdminTopic {
  id: number;
  slug: string;
  name: string;
  generator_kind: string;
  schedule_cron: string | null;
  zone_id: string | null;
  zone_name: string | null;
  category_name: string;
  last_run_status: string | null;
  last_run_at: string | null;
}

export function createTopic(payload: CreateTopicPayload) {
  return apiFetch("/v1/admin/question-topics", { method: "POST", body: JSON.stringify(payload) });
}

export function listTopics(): Promise<AdminTopic[]> {
  return apiFetch("/v1/admin/question-topics");
}

export function generateNow(topicId: number) {
  return apiFetch(`/v1/admin/question-topics/${topicId}/generate`, { method: "POST" });
}

/** Find-or-create by name (SPEC.md §26) — same as the question wizard's category field. */
export function resolveCategory(name: string): Promise<{ id: number; created: boolean }> {
  return apiFetch("/v1/admin/categories", { method: "POST", body: JSON.stringify({ name }) });
}

/** A starting draft, never the system of record (SPEC.md §27) — reviewed/edited before saving. */
export function translateText(text: string, targetLang: "kn"): Promise<{ translated: string }> {
  return apiFetch("/v1/admin/translate", { method: "POST", body: JSON.stringify({ text, targetLang }) });
}
