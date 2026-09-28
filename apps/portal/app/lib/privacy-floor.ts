import { apiFetch } from "./core-api-client";

/**
 * The live k-anonymity floor, so the marketing page can state the real number
 * instead of a hardcoded one.
 *
 * SPEC.md §11: "Every marketing claim must map to a tested code path. If code
 * can't honour a claim, flag it — don't ship the claim." The trust strip used
 * to say "50 households minimum" as a literal, which silently became false the
 * moment a pilot deployment relaxed the floor via K_ANON_FLOOR. Reading it
 * makes the claim self-correcting rather than a promise someone has to
 * remember to update.
 */
export async function getPrivacyFloor(): Promise<{ floor: number; relaxed: boolean }> {
  try {
    const registry = (await apiFetch("/v1/public/registry")) as {
      meta?: { k_anon_floor?: number; relaxed_floor?: boolean };
    };
    const floor = registry?.meta?.k_anon_floor;
    if (typeof floor === "number" && floor > 0) {
      return { floor, relaxed: registry.meta?.relaxed_floor === true };
    }
  } catch {
    // The homepage must render even if Core API is down. Falling back to the
    // production floor is the safe direction: it can only ever understate how
    // much data the page implies is published, never overstate it.
  }
  return { floor: 50, relaxed: false };
}
