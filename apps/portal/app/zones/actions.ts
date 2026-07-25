"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCategory,
  CreateCategoryPayload,
  createZone,
  CreateZonePayload,
  updateZoneCentroid,
  UpdateZoneCentroidPayload,
  updateZoneLanguage,
  UpdateZoneLanguagePayload,
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
