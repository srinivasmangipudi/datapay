import { API_BASE_URL } from "./config";

export interface Zone {
  id: string;
  parentId: string | null;
  level: "constituency" | "hobli" | "panchayat" | "village";
  name: string;
  nameKn: string | null;
}

export interface VerifyOtpResult {
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
  textKn: string | null;
  rewardTokens: number;
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
  language: string;
  answeredAt: string;
}

export interface PulseAnswerResult {
  clientMsgId: string;
  status: "credited" | "already_synced";
}

export interface TokensSummary {
  balance: number;
  history: {
    entry: string;
    tokens: number;
    refType: string;
    refId: string;
    createdAt: string;
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

export function getZones(): Promise<Zone[]> {
  return request("/v1/zones");
}

export function completeOnboarding(
  token: string,
  zoneId: string,
  locale: string
): Promise<MemberProfile> {
  return request(
    "/v1/me",
    { method: "PUT", body: JSON.stringify({ zoneId, locale }) },
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

export function submitSnap(
  token: string,
  dto: { clientMsgId: string; imageBase64: string; categoryId?: number; capturedAt: string }
): Promise<{ status: "credited" | "already_synced"; snapId?: number }> {
  return request("/v1/snaps", { method: "POST", body: JSON.stringify(dto) }, token);
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
