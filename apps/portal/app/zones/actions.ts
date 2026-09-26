"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CreateCategoryPayload,
  CreateZonePayload,
  UpdateZoneCentroidPayload,
  UpdateZoneLanguagePayload,
  createCategory,
  createZone,
  getCategoryUsage,
  mergeCategories,
  type CategoryUsage,
  type MergeResult,
  updateZoneCentroid,
  updateZoneLanguage,
} from "./core-api";

export async function createZoneAction(payload: CreateZonePayload): Promise<void> {
  try {
    await createZone(payload);
  } catch (err) {
    revalidatePath("/zones");
    redirect(`/zones?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/zones");
  redirect("/zones?created=zone");
}

export async function updateZoneCentroidAction(id: string, payload: UpdateZoneCentroidPayload): Promise<void> {
  try {
    await updateZoneCentroid(id, payload);
  } catch (err) {
    revalidatePath("/zones");
    redirect(`/zones?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/zones");
  redirect("/zones?updated=zone");
}

export async function updateZoneLanguageAction(id: string, payload: UpdateZoneLanguagePayload): Promise<void> {
  try {
    await updateZoneLanguage(id, payload);
  } catch (err) {
    revalidatePath("/zones");
    redirect(`/zones?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/zones");
  redirect("/zones?updated=zone");
}

export async function createCategoryAction(payload: CreateCategoryPayload): Promise<void> {
  try {
    await createCategory(payload);
  } catch (err) {
    revalidatePath("/zones");
    redirect(`/zones?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/zones");
  redirect("/zones?created=category");
}

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

// These two return a result rather than redirecting like the actions above:
// the merge UI previews, then confirms, in place — a redirect would throw the
// preview away between the two steps.
export async function getCategoryUsageAction(id: number): Promise<ActionResult<CategoryUsage>> {
  try {
    return { ok: true, data: await getCategoryUsage(id) };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function mergeCategoriesAction(
  sourceId: number,
  targetId: number
): Promise<ActionResult<MergeResult>> {
  try {
    const data = await mergeCategories(sourceId, targetId);
    revalidatePath("/zones");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
