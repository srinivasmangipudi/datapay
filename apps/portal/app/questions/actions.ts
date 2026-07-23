"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createQuestion, CreateQuestionPayload } from "./core-api";

// Same pattern as apps/portal/app/intelligence/actions.ts: a thrown error
// inside a Server Action surfaces as Next's raw crash overlay, not a
// readable message. Catch here, redirect with the message as a query param,
// rendered as an in-page banner instead (see page.tsx).
export async function createQuestionAction(payload: CreateQuestionPayload): Promise<void> {
  try {
    await createQuestion(payload);
  } catch (err) {
    revalidatePath("/questions");
    redirect(`/questions?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/questions");
  redirect("/questions?created=1");
}
