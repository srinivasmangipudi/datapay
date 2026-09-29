import { apiFetch } from "../lib/core-api-client";

export interface DeliveryJob {
  id: number;
  relay_token: string;
  quantity: number;
  status: string;
  created_at: string;
  name_en: string;
  unit_spec: string | null;
  organization_name: string;
}

export function deliveryLogin(phone: string, password: string): Promise<{ token: string; name: string; zoneName: string }> {
  return apiFetch("/v1/delivery/login", {
    method: "POST",
    body: JSON.stringify({ phone, password }),
  });
}

/** The agent's own token, not the portal session — this surface is for people
    who are not ops and must never see the ops portal. */
export function listMyDeliveries(token: string): Promise<DeliveryJob[]> {
  return apiFetch("/v1/delivery/deliveries", { headers: { Authorization: `Bearer ${token}` } });
}
