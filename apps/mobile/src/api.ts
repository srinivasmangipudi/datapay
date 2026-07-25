import { API_BASE_URL } from "./config";

export interface Zone {
  id: string;
  parentId: string | null;
  level: "constituency" | "hobli" | "panchayat" | "village";
  name: string;
  nameKn: string | null;
}

// SPEC.md §36 — a returning member gets a session immediately; a first-time
// member gets a batch of name candidates to choose from instead (nothing is
// committed until commitAlias() is called).
export type VerifyOtpResult =
  | { status: "returning"; token: string; aliasId: string; displayAlias: string }
  | { status: "choose_alias"; pendingToken: string; aliasId: string; candidates: string[] };

export interface CommitAliasResult {
  token: string;
  aliasId: string;
  displayAlias: string;
}

export interface MemberProfile {
  aliasId: string;
  displayAlias: string;
  zoneId: string;
  householdSizeBand: string | null;
  locale: string;
  joinedAt: string;
  status: string;
  trustScore: number;
  zoneConfirmed: boolean;
  requestedAreaNote: string | null;
}

export interface ResolveLocationResult {
  zone: { id: string; name: string; nameKn: string | null; level: string; parentId: string | null };
  matchType: "existing" | "created";
  geocodedLabel: string;
}

export interface PulseOption {
  id: number;
  labelEn: string;
  labelKn: string | null;
  sort: number;
}

export interface PulseQuestion {
  id: number;
  categoryId: number;
  type: "single" | "multi" | "yesno" | "intent_window" | "numeric" | "free_text";
  textEn: string;
  // SPEC.md §39 — Hindi is always attempted; textLocal/localLanguage are only
  // populated when the member's zone resolves to a non-Hindi local language
  // (never a duplicate of textHi under a second label).
  textHi: string | null;
  textLocal: string | null;
  localLanguage: string | null;
  rewardTokens: number;
  allowPhoto: boolean;
  allowVoice: boolean;
  options: PulseOption[];
}

export interface PulseAnswerInput {
  clientMsgId: string;
  questionId: number;
  optionIds?: number[];
  numericValue?: number;
  textValue?: string;
  photoBase64?: string;
  inputMode: "tap" | "voice" | "snap" | "text";
  // Best-effort — used server-side to resolve the nearest zone, never stored
  // as raw coordinates (SPEC.md §35). Omitted entirely if permission was
  // denied or a reading wasn't available in time; never blocks answering.
  lat?: number;
  lng?: number;
  language: string;
  answeredAt: string;
}

export interface PulseAnswerResult {
  clientMsgId: string;
  status: "credited" | "already_synced";
}

export interface TokensSummary {
  // Issued — earned, unspent, still just a promise (SPEC.md §40).
  balance: number;
  // Realised — redeemed AND the underlying offer actually delivered, so a
  // real rupee has been reserved to back it. Never a duplicate of balance:
  // a token leaves balance the moment it's redeemed, well before delivery.
  realisedTokens: number;
  history: {
    entry: string;
    tokens: number;
    refType: string;
    refId: string;
    createdAt: string;
    label: string;
    labelKn: string;
  }[];
}

export interface ConsentCategory {
  categoryId: number;
  slug: string;
  name: string;
  nameKn: string | null;
  granted: boolean;
  updatedAt: string | null;
}

export interface FundBalance {
  zoneId: string;
  balancePaise: number;
}

export interface FundProject {
  id: number;
  title: string;
  titleKn: string | null;
  estimatePaise: number;
  status: "proposed" | "voting" | "approved" | "funded" | "done";
  yesVotes: number;
  noVotes: number;
  myVote: "yes" | "no" | null;
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message ?? `Request to ${path} failed (${res.status})`);
  }
  return data as T;
}

export function requestOtp(phoneE164: string, name: string): Promise<{ status: "otp_sent" }> {
  return request("/v1/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phoneE164, name }),
  });
}

export function verifyOtp(phoneE164: string, otp: string): Promise<VerifyOtpResult> {
  return request("/v1/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phoneE164, otp }),
  });
}

export function getAliasCandidates(pendingToken: string): Promise<{ candidates: string[] }> {
  return request("/v1/auth/otp/alias-candidates", {
    method: "POST",
    body: JSON.stringify({ pendingToken }),
  });
}

export function commitAlias(pendingToken: string, displayAlias: string): Promise<CommitAliasResult> {
  return request("/v1/auth/otp/commit-alias", {
    method: "POST",
    body: JSON.stringify({ pendingToken, displayAlias }),
  });
}

export function getZones(): Promise<Zone[]> {
  return request("/v1/zones");
}

// SPEC.md §38 — "my village isn't listed" fallback: "detect my location" or
// "enter my address," either way geocoded to a real place, matched to an
// existing zone or created on the spot.
export function resolveLocation(
  token: string,
  location: { lat: number; lng: number } | { address: string }
): Promise<ResolveLocationResult> {
  return request("/v1/zones/resolve-location", { method: "POST", body: JSON.stringify(location) }, token);
}

export function completeOnboarding(
  token: string,
  zoneId: string,
  locale: string,
  opts?: { zoneConfirmed?: boolean; requestedAreaNote?: string }
): Promise<MemberProfile> {
  return request(
    "/v1/me",
    {
      method: "PUT",
      body: JSON.stringify({
        zoneId,
        locale,
        zoneConfirmed: opts?.zoneConfirmed,
        requestedAreaNote: opts?.requestedAreaNote,
      }),
    },
    token
  );
}

export function getMe(token: string): Promise<MemberProfile> {
  return request("/v1/me", {}, token);
}

export function getPulseToday(token: string): Promise<PulseQuestion[]> {
  return request("/v1/pulse/today", {}, token);
}

export function submitPulseAnswers(
  token: string,
  answers: PulseAnswerInput[]
): Promise<{ results: PulseAnswerResult[] }> {
  return request(
    "/v1/pulse/answers",
    { method: "POST", body: JSON.stringify({ answers }) },
    token
  );
}

export function transcribeVoice(
  token: string,
  audioBase64: string,
  language: string
): Promise<{ transcript: string; translatedText?: string }> {
  return request(
    "/v1/voice/transcribe",
    { method: "POST", body: JSON.stringify({ audioBase64, language }) },
    token
  );
}

export function getTokens(token: string): Promise<TokensSummary> {
  return request("/v1/tokens", {}, token);
}

export function getConsents(token: string): Promise<ConsentCategory[]> {
  return request("/v1/vault/consents", {}, token);
}

export function setConsent(
  token: string,
  categoryId: number,
  granted: boolean
): Promise<{ categoryId: number; granted: boolean }> {
  return request(
    `/v1/vault/consents/${categoryId}`,
    { method: "PUT", body: JSON.stringify({ granted }) },
    token
  );
}

export function getFundBalance(token: string): Promise<FundBalance> {
  return request("/v1/fund", {}, token);
}

export function getFundProjects(token: string): Promise<FundProject[]> {
  return request("/v1/fund/projects", {}, token);
}

export function proposeFundProject(
  token: string,
  title: string,
  estimatePaise: number
): Promise<{ id: number }> {
  return request(
    "/v1/fund/projects",
    { method: "POST", body: JSON.stringify({ title, estimatePaise }) },
    token
  );
}

export function voteFundProject(
  token: string,
  projectId: number,
  vote: "yes" | "no"
): Promise<{ ok: true }> {
  return request(
    `/v1/fund/projects/${projectId}/vote`,
    { method: "POST", body: JSON.stringify({ vote }) },
    token
  );
}
