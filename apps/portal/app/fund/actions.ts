"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createFundProject, CreateFundProjectPayload, updateFundProject, UpdateFundProjectPayload } from "./core-api";

export async function createFundProjectAction(payload: CreateFundProjectPayload): Promise<void> {
  try {
    await createFundProject(payload);
  } catch (err) {
    revalidatePath("/fund");
    redirect(`/fund?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/fund");
  redirect("/fund?created=1");
}

export async function updateFundProjectAction(id: number, payload: UpdateFundProjectPayload): Promise<void> {
  try {
    await updateFundProject(id, payload);
  } catch (err) {
    revalidatePath("/fund");
    redirect(`/fund?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/fund");
  redirect("/fund?updated=1");
}
