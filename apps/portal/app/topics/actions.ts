"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createTopic, CreateTopicPayload, generateNow, resolveCategory, translateText } from "./core-api";

export type CreateTopicFormPayload = Omit<CreateTopicPayload, "categoryId"> & {
  categoryName: string;
};

export async function createTopicAction(payload: CreateTopicFormPayload): Promise<void> {
  const { categoryName, ...rest } = payload;
  try {
    // SPEC.md §26 — resolve (find-or-create) the free-typed category before
    // the topic itself is created.
    const category = await resolveCategory(categoryName);
    await createTopic({ ...rest, categoryId: category.id });
  } catch (err) {
    revalidatePath("/topics");
    redirect(`/topics?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/topics");
  redirect("/topics?created=1");
}

// Called directly from a client onClick, not a form submission (SPEC.md §27).
export async function translateToKannada(text: string): Promise<string> {
  const { translated } = await translateText(text, "kn");
  return translated;
}

export async function generateNowAction(formData: FormData): Promise<void> {
  const topicId = Number(formData.get("topicId"));
  try {
    await generateNow(topicId);
  } catch (err) {
    revalidatePath("/topics");
    redirect(`/topics?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/topics");
  redirect("/topics?generated=1");
}
