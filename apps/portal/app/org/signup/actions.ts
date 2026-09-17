"use server";

import { redirect } from "next/navigation";
import { signupOrg } from "../core-api";

export async function orgSignupAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    await signupOrg(name, email, password);
  } catch (err) {
    redirect(`/org/signup?error=${encodeURIComponent((err as Error).message)}`);
  }
  redirect("/org/signup?submitted=1");
}
