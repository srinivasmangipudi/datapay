// Every read AND write on this page goes through Core API's admin endpoints
// — never a direct query against the portal's restricted DB role, which has
// no grant on intelligence_sources/intelligence_documents/zone_understanding/
// questions and deliberately isn't getting one (§10's boundary stays exactly
// as tested: aggregates/zones/categories only, nothing else).
function apiBaseUrl(): string {
  const url = process.env.CORE_API_INTERNAL_URL;
  if (!url) throw new Error("Missing CORE_API_INTERNAL_URL");
  return url;
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      `Core API ${init?.method ?? "GET"} ${path} → ${res.status}: ${JSON.stringify(data)}`
    );
  }
  return data;
}

export interface IntelligenceSource {
  id: number;
  zone_id: string;
  kind: string;
  external_ref: string;
  display_name: string;
  created_at: string;
  last_synced_at: string | null;
}

export interface IntelligenceDocument {
  id: number;
  external_id: string;
  title: string;
  mime_type: string | null;
  fetched_at: string;
  has_text: boolean;
}

export interface ZoneUnderstanding {
  id: number;
  summaryEn: string;
  summaryKn: string | null;
  knowledgeMap: {
    economicActivities: string[];
    commonProductsAndBrands: string[];
    seasonalPatterns: string[];
    notableConcerns: string[];
    demandSignals: string[];
  };
  sourceDocumentIds: number[];
  modelUsed: string;
  generatedAt: string;
}

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
}

export function listSources(zoneId: string): Promise<IntelligenceSource[]> {
  return apiFetch(`/v1/admin/intelligence-sources?zoneId=${zoneId}`);
}

export function listDocuments(sourceId: number): Promise<IntelligenceDocument[]> {
  return apiFetch(`/v1/admin/intelligence-sources/${sourceId}/documents`);
}

export async function getUnderstanding(zoneId: string): Promise<ZoneUnderstanding | null> {
  const result = await apiFetch(`/v1/admin/zones/${zoneId}/understanding`);
  return "message" in result ? null : result;
}

export function listDraftQuestions(): Promise<DraftQuestion[]> {
  return apiFetch(`/v1/admin/questions?review_state=draft`);
}

export function connectSource(zoneId: string, externalRef: string, displayName: string) {
  return apiFetch(`/v1/admin/intelligence-sources`, {
    method: "POST",
    body: JSON.stringify({ zoneId, externalRef, displayName }),
  });
}

export function syncSource(sourceId: number) {
  return apiFetch(`/v1/admin/intelligence-sources/${sourceId}/sync`, { method: "POST" });
}

export function refreshUnderstanding(zoneId: string) {
  return apiFetch(`/v1/admin/zones/${zoneId}/understanding/refresh`, { method: "POST" });
}

export function reviewQuestion(questionId: number, decision: "approve" | "reject") {
  return apiFetch(`/v1/admin/questions/${questionId}/${decision}`, { method: "POST" });
}
