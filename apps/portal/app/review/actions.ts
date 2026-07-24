"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reviewQuestion } from "./core-api";

export async function reviewQuestionAction(formData: FormData): Promise<void> {
  const questionId = Number(formData.get("questionId"));
  const decision = String(formData.get("decision")) as "approve" | "reject";

  try {
    await reviewQuestion(questionId, decision);
  } catch (err) {
    revalidatePath("/review");
    redirect(`/review?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/review");
  redirect("/review");
}
