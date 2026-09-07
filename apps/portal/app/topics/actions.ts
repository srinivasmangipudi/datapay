"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  connectIntelligenceSource,
  createTopic,
  CreateTopicPayload,
  generateNow,
  getZoneUnderstanding,
  refreshZoneUnderstanding,
  resolveCategory,
  syncIntelligenceSource,
  translateText,
} from "./core-api";

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

export interface IngestStatus {
  ready: boolean;
  message: string; // a summary snippet if ready, otherwise why not / the error
}

// Connect a web_link source, sync it, and refresh the zone's understanding
// in one step — called directly from the wizard's client code so "paste a
// link" IS the whole ingestion flow, no separate trip to another page.
export async function ingestLinkAction(zoneId: string, url: string): Promise<IngestStatus> {
  if (!/^https?:\/\//i.test(url.trim())) {
    return { ready: false, message: "That doesn't look like a URL — include https://" };
  }
  try {
    const source = await connectIntelligenceSource(zoneId, url.trim(), url.trim(), "web_link");
    const sync = await syncIntelligenceSource(source.id);
    if (sync.synced === 0 && sync.unchanged === 0) {
      return { ready: false, message: "Nothing readable was found at that link." };
    }
    const understanding = await refreshZoneUnderstanding(zoneId);
    return { ready: true, message: understanding.summaryEn };
  } catch (err) {
    return { ready: false, message: (err as Error).message };
  }
}

export async function getZoneUnderstandingStatus(zoneId: string): Promise<IngestStatus> {
  try {
    const understanding = await getZoneUnderstanding(zoneId);
    if (understanding.summaryEn) {
      return { ready: true, message: understanding.summaryEn };
    }
    return { ready: false, message: understanding.message ?? "No understanding yet." };
  } catch (err) {
    return { ready: false, message: (err as Error).message };
  }
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
