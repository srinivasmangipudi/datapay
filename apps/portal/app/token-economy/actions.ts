"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runAggregation, runTokenRate } from "./core-api";

export async function runTokenRateAction(): Promise<void> {
  try {
    await runTokenRate();
  } catch (err) {
    redirect(`/token-economy?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/token-economy");
  revalidatePath("/");
  redirect("/token-economy?ran=token-rate");
}

export async function runAggregationAction(): Promise<void> {
  try {
    await runAggregation();
  } catch (err) {
    redirect(`/token-economy?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/token-economy");
  revalidatePath("/");
  redirect("/token-economy?ran=aggregation");
}
