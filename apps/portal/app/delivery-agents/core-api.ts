import { apiFetch } from "../lib/core-api-client";

export interface DeliveryAgent {
  id: string;
  name: string;
  phone_e164: string;
  active: boolean;
  created_at: string;
  zone_name: string;
  zone_level: string;
}

export function listDeliveryAgents(): Promise<DeliveryAgent[]> {
  return apiFetch("/v1/admin/delivery-agents");
}

export function createDeliveryAgent(input: {
  name: string;
  phone: string;
  zoneId: string;
  password: string;
}) {
  return apiFetch("/v1/admin/delivery-agents", { method: "POST", body: JSON.stringify(input) });
}

export function setDeliveryAgentActive(id: string, active: boolean) {
  return apiFetch(`/v1/admin/delivery-agents/${id}/active`, {
    method: "POST",
    body: JSON.stringify({ active }),
  });
}

export function resetDeliveryAgentPassword(id: string, password: string) {
  return apiFetch(`/v1/admin/delivery-agents/${id}/password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}
