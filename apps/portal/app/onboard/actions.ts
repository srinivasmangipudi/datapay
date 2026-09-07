"use server";

import {
  connectIntelligenceSource,
  createQuestion,
  CreateQuestionPayload,
  createTopic,
  createZone,
  CreateZonePayload,
  generateNow,
  GenerateNowResult,
  getZoneUnderstanding,
  refreshZoneUnderstanding,
  resolveCategory,
  reviewQuestion,
  syncIntelligenceSource,
  ZoneUnderstandingStatus,
} from "./core-api";

export interface ActionResult<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

export async function createZoneAction(payload: CreateZonePayload): Promise<ActionResult<{ id: string }>> {
  try {
    const zone = await createZone(payload);
    return { ok: true, data: zone };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function getZoneUnderstandingAction(zoneId: string): Promise<ZoneUnderstandingStatus> {
  try {
    const understanding = await getZoneUnderstanding(zoneId);
    return understanding.summaryEn
      ? understanding
      : { message: understanding.message ?? "No understanding yet." };
  } catch (err) {
    return { message: (err as Error).message };
  }
}

// Connect a web_link source, sync it, and refresh the zone's understanding
// in one step — same as topics/actions.ts's ingestLinkAction, kept as its
// own copy here since the two wizards' result shapes differ slightly
// (this one returns the full understanding, not just a ready/not-ready flag).
export async function ingestZoneLinkAction(zoneId: string, url: string): Promise<ActionResult<ZoneUnderstandingStatus>> {
  if (!/^https?:\/\//i.test(url.trim())) {
    return { ok: false, message: "That doesn't look like a URL — include https://" };
  }
  try {
    const source = await connectIntelligenceSource(zoneId, url.trim(), url.trim(), "web_link");
    const sync = await syncIntelligenceSource(source.id);
    if (sync.synced === 0 && sync.unchanged === 0) {
      return { ok: false, message: "Nothing readable was found at that link." };
    }
    const understanding = await refreshZoneUnderstanding(zoneId);
    return { ok: true, data: understanding };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function resolveCategoryAction(name: string): Promise<ActionResult<{ id: number }>> {
  try {
    const category = await resolveCategory(name);
    return { ok: true, data: category };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

// Creates the topic, then immediately triggers its first run regardless of
// whether a recurring schedule was also set — the wizard always has
// something to show in step 4, rather than leaving the first run to a
// separate later click.
export async function createTopicAndRunAction(payload: {
  slug: string;
  name: string;
  categoryId: number;
  config: Record<string, unknown>;
  scheduleCron?: string;
  zoneId: string;
}): Promise<ActionResult<GenerateNowResult>> {
  try {
    const topic = await createTopic({ ...payload, generatorKind: "document_grounded" });
    const run = await generateNow(topic.id);
    return { ok: true, data: run as GenerateNowResult };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function createQuestionDirectAction(
  payload: CreateQuestionPayload
): Promise<ActionResult<{ id: number }>> {
  try {
    const question = await createQuestion(payload);
    return { ok: true, data: question };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function reviewDraftAction(
  questionId: number,
  decision: "approve" | "reject"
): Promise<ActionResult<void>> {
  try {
    await reviewQuestion(questionId, decision);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
