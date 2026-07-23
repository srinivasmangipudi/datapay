"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as coreApi from "./core-api";

function pagePath(zoneId: string, error?: string): string {
  const base = `/intelligence?zoneId=${zoneId}`;
  return error ? `${base}&error=${encodeURIComponent(error)}` : base;
}

// A thrown error inside a Server Action surfaces as Next's raw "Unhandled
// Runtime Error" crash overlay — correct that the error isn't swallowed, but
// a bad way for ops to learn "you haven't configured Google/Anthropic
// credentials yet." Catching here and redirecting with the message as a
// query param renders it as a normal in-page banner instead (see page.tsx).
async function runAction(zoneId: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    revalidatePath(pagePath(zoneId));
    redirect(pagePath(zoneId, (err as Error).message));
  }
  revalidatePath(pagePath(zoneId));
  redirect(pagePath(zoneId));
}

export async function connectSourceAction(formData: FormData) {
  const zoneId = String(formData.get("zoneId"));
  const externalRef = String(formData.get("externalRef"));
  const displayName = String(formData.get("displayName"));
  await runAction(zoneId, () => coreApi.connectSource(zoneId, externalRef, displayName));
}

export async function syncSourceAction(formData: FormData) {
  const zoneId = String(formData.get("zoneId"));
  const sourceId = Number(formData.get("sourceId"));
  await runAction(zoneId, () => coreApi.syncSource(sourceId));
}

export async function refreshUnderstandingAction(formData: FormData) {
  const zoneId = String(formData.get("zoneId"));
  await runAction(zoneId, () => coreApi.refreshUnderstanding(zoneId));
}

export async function reviewQuestionAction(formData: FormData) {
  const zoneId = String(formData.get("zoneId"));
  const questionId = Number(formData.get("questionId"));
  const decision = formData.get("decision") === "reject" ? "reject" : "approve";
  await runAction(zoneId, () => coreApi.reviewQuestion(questionId, decision));
}
