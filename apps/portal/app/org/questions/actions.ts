"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OrgQuestionPayload, submitOrgQuestion } from "../core-api";

export async function submitOrgQuestionAction(payload: OrgQuestionPayload): Promise<void> {
  const token = cookies().get("org_session")?.value;
  if (!token) {
    redirect("/org/login");
  }

  try {
    await submitOrgQuestion(token, payload);
  } catch (err) {
    redirect(`/org/questions?error=${encodeURIComponent((err as Error).message)}`);
  }
  redirect("/org/questions?submitted=1");
}
