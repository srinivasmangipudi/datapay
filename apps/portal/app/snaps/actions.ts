"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rejectSnap, verifySnap } from "./core-api";

export async function reviewSnapAction(formData: FormData): Promise<void> {
  const snapId = Number(formData.get("snapId"));
  const decision = String(formData.get("decision"));

  try {
    if (decision === "verify") await verifySnap(snapId);
    else await rejectSnap(snapId);
  } catch (err) {
    revalidatePath("/snaps");
    redirect(`/snaps?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/snaps");
  redirect("/snaps");
}
