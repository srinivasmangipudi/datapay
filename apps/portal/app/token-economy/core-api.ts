import { apiFetch } from "../lib/core-api-client";

export function runTokenRate() {
  return apiFetch("/v1/admin/token-rate/run", { method: "POST" });
}

export function runAggregation() {
  return apiFetch("/v1/admin/aggregation/run", { method: "POST" });
}
