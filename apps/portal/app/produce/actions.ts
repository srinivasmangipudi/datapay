"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runMatching, runPayoutBatch } from "./core-api";

export async function runMatchingAction(formData: FormData): Promise<void> {
  const listingId = Number(formData.get("listingId"));
  try {
    await runMatching(listingId);
  } catch (err) {
    revalidatePath("/produce");
    redirect(`/produce?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/produce");
  redirect("/produce?matched=1");
}

export async function runPayoutBatchAction(): Promise<void> {
  try {
    await runPayoutBatch();
  } catch (err) {
    redirect(`/produce?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/produce");
  redirect("/produce?paid=1");
}
