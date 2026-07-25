"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createQuestion, CreateQuestionPayload, resolveCategory, translateText } from "./core-api";

export type CreateQuestionFormPayload = Omit<CreateQuestionPayload, "categoryId"> & {
  categoryName: string;
};

// Same pattern as apps/portal/app/intelligence/actions.ts: a thrown error
// inside a Server Action surfaces as Next's raw crash overlay, not a
// readable message. Catch here, redirect with the message as a query param,
// rendered as an in-page banner instead (see page.tsx).
export async function createQuestionAction(payload: CreateQuestionFormPayload): Promise<void> {
  const { categoryName, ...rest } = payload;
  try {
    // SPEC.md §26 — the wizard sends free text, not a pre-picked id; resolve
    // (find-or-create) the category before the question itself is created.
    const category = await resolveCategory(categoryName);
    await createQuestion({ ...rest, categoryId: category.id });
  } catch (err) {
    revalidatePath("/questions");
    redirect(`/questions?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/questions");
  redirect("/questions?created=1");
}

// Called directly from a client onClick, not a form submission — no
// redirect() here, just a value the wizard drops into the (still editable)
// translation field for that language (SPEC.md §27, generalized in §39
// beyond the original Kannada-only version).
export async function translateQuestionText(text: string, targetLang: string): Promise<string> {
  const { translated } = await translateText(text, targetLang);
  return translated;
}
