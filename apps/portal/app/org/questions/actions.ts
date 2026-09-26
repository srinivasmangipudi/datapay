"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OrgQuestionFormPayload, resolveCategory, submitOrgQuestion } from "../core-api";

export async function submitOrgQuestionAction(payload: OrgQuestionFormPayload): Promise<void> {
  const token = cookies().get("org_session")?.value;
  if (!token) {
    redirect("/org/login");
  }

  try {
    // Find-or-create: an org can name a category that doesn't exist yet
    // instead of being limited to what ops has already defined.
    const { categoryName, ...rest } = payload;
    const { id: categoryId } = await resolveCategory(token, categoryName.trim());
    await submitOrgQuestion(token, { ...rest, categoryId });
  } catch (err) {
    redirect(`/org/questions?error=${encodeURIComponent((err as Error).message)}`);
  }
  redirect("/org/questions?submitted=1");
}
