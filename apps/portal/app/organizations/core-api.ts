import { apiFetch } from "../lib/core-api-client";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

export interface CreateOrganizationPayload {
  name: string;
  email: string;
  password: string;
}

export function listOrganizations(): Promise<Organization[]> {
  return apiFetch("/v1/admin/organizations");
}

export function createOrganization(payload: CreateOrganizationPayload): Promise<{ id: string; slug: string }> {
  return apiFetch("/v1/admin/organizations", { method: "POST", body: JSON.stringify(payload) });
}
