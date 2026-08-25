import { apiFetch } from "../lib/core-api-client";

export function runTokenRate() {
  return apiFetch("/v1/admin/token-rate/run", { method: "POST" });
}

export function runAggregation() {
  return apiFetch("/v1/admin/aggregation/run", { method: "POST" });
}

export interface TokenEconomyOverview {
  totalMembers: number;
  totalTokens: number;
  corpusFundPaise: number;
}

// TOKEN_ECONOMY_REDESIGN.md — members/token_ledger/corpus_fund_ledger aren't
// in the portal role's direct-read grant (§10: demand_aggregates/
// token_rate/zones/categories only), so this goes through Core API like
// every other member-adjacent read (questions, zones, fund-projects).
export function getTokenEconomyOverview(): Promise<TokenEconomyOverview> {
  return apiFetch("/v1/admin/token-economy/overview");
}
