"use server";

import { revalidatePath } from "next/cache";
import * as coreApi from "./core-api";

function pagePath(zoneId: string): string {
  return `/intelligence?zoneId=${zoneId}`;
}

export async function connectSourceAction(formData: FormData) {
  const zoneId = String(formData.get("zoneId"));
  const externalRef = String(formData.get("externalRef"));
  const displayName = String(formData.get("displayName"));
  await coreApi.connectSource(zoneId, externalRef, displayName);
  revalidatePath(pagePath(zoneId));
}

export async function syncSourceAction(formData: FormData) {
  const zoneId = String(formData.get("zoneId"));
  const sourceId = Number(formData.get("sourceId"));
  await coreApi.syncSource(sourceId);
  revalidatePath(pagePath(zoneId));
}

export async function refreshUnderstandingAction(formData: FormData) {
  const zoneId = String(formData.get("zoneId"));
  await coreApi.refreshUnderstanding(zoneId);
  revalidatePath(pagePath(zoneId));
}

export async function reviewQuestionAction(formData: FormData) {
  const zoneId = String(formData.get("zoneId"));
  const questionId = Number(formData.get("questionId"));
  const decision = formData.get("decision") === "reject" ? "reject" : "approve";
  await coreApi.reviewQuestion(questionId, decision);
  revalidatePath(pagePath(zoneId));
}
