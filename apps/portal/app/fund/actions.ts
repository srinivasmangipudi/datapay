"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createFundProject, CreateFundProjectPayload } from "./core-api";

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
