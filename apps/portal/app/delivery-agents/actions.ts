"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createDeliveryAgent,
  resetDeliveryAgentPassword,
  setDeliveryAgentActive,
} from "./core-api";

export async function createDeliveryAgentAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const zoneId = String(formData.get("zoneId") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await createDeliveryAgent({ name, phone, zoneId, password });
  } catch (err) {
    redirect(`/delivery-agents?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/delivery-agents");
  // The passcode goes back in the URL ONCE so ops can read it out to the
  // person standing in front of them. It is never stored in plaintext and
  // never shown again — a reset is the only way to see one after this.
  redirect(`/delivery-agents?created=${encodeURIComponent(name)}&passcode=${encodeURIComponent(password)}`);
}

export async function setDeliveryAgentActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get("agentId") ?? "");
  const active = String(formData.get("active")) === "true";

  try {
    await setDeliveryAgentActive(id, active);
  } catch (err) {
    redirect(`/delivery-agents?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/delivery-agents");
  redirect(`/delivery-agents?${active ? "reactivated" : "deactivated"}=1`);
}

export async function resetDeliveryAgentPasswordAction(formData: FormData): Promise<void> {
  const id = String(formData.get("agentId") ?? "");
  const name = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await resetDeliveryAgentPassword(id, password);
  } catch (err) {
    redirect(`/delivery-agents?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/delivery-agents");
  redirect(`/delivery-agents?created=${encodeURIComponent(name)}&passcode=${encodeURIComponent(password)}`);
}
