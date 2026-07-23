/**
 * NOT YET REAL. SPEC.md §11: "every marketing claim must map to a tested code
 * path — if code can't honour a claim, flag it, don't ship it." This does not
 * detect faces; it's a placeholder that always reports none, so Snap keeps
 * working end-to-end while this is wired to a real on-device model (e.g. an
 * ML Kit face-detection module) before "rejects a face" becomes a real claim.
 */
export async function hasFace(_imageBase64: string): Promise<boolean> {
  return false;
}
