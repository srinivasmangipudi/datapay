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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
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
  return request("/v1/me", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ zoneId, locale }),
  });
}
