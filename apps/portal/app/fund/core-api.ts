import { apiFetch } from "../lib/core-api-client";

export interface FundProject {
  id: number;
  title: string;
  title_kn: string | null;
  estimate_paise: number;
  status: string;
  created_at: string;
  zone_id: string;
  zone_name: string;
  yes_votes: string;
  no_votes: string;
}

export interface CreateFundProjectPayload {
  zoneId: string;
  title: string;
  titleKn?: string;
  estimatePaise: number;
}

export function listFundProjects(): Promise<FundProject[]> {
  return apiFetch("/v1/admin/fund-projects");
}

export function createFundProject(payload: CreateFundProjectPayload) {
  return apiFetch("/v1/admin/fund-projects", { method: "POST", body: JSON.stringify(payload) });
}
