import { apiFetch } from "../lib/core-api-client";

export interface QualityFlag {
  id: number;
  alias_id: string;
  rule: string;
  detail: string;
  at: string;
}

export interface TrustScoreRow {
  alias_id: string;
  display_alias: string;
  trust_score: string;
  flag_count: string;
}

export function listQualityFlags(): Promise<QualityFlag[]> {
  return apiFetch("/v1/admin/quality-flags");
}

export function listTrustScores(): Promise<TrustScoreRow[]> {
  return apiFetch("/v1/admin/trust-scores");
}
