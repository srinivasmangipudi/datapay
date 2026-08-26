"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createOrganization } from "./core-api";

export async function createOrganizationAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    await createOrganization({ name, email, password });
  } catch (err) {
    revalidatePath("/organizations");
    redirect(`/organizations?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/organizations");
  redirect("/organizations?created=1");
}
