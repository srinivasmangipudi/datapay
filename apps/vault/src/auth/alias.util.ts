import { createHmac, randomInt } from "crypto";

const RIVERS = [
  "KAVERI",
  "HEMAVATHI",
  "TUNGA",
  "BHADRA",
  "KABINI",
  "SHIMSHA",
  "YAGACHI",
  "NETRAVATHI",
];

const BIRDS = [
  "HERON",
  "EGRET",
  "KOEL",
  "MYNA",
  "BULBUL",
  "KINGFISHER",
  "SUNBIRD",
  "HOOPOE",
  "MUNIA",
  "BEE-EATER",
];

/**
 * LAW 1: alias_id = HMAC-SHA256(user_id, ALIAS_PEPPER). The pepper lives only in
 * Vault's KMS/env — Core can never reverse this without it, and even Vault only
 * reverses it via the write-once alias_map lookup, never by re-deriving user_id
 * from alias_id (HMAC is one-way).
 */
export function computeAliasId(userId: string, pepper: string): string {
  if (!pepper) {
    throw new Error("ALIAS_PEPPER is required to compute an alias_id");
  }
  return createHmac("sha256", pepper).update(userId).digest("hex");
}

export function generateDisplayAliasCandidate(): string {
  const river = RIVERS[randomInt(RIVERS.length)];
  const bird = BIRDS[randomInt(BIRDS.length)];
  const number = randomInt(1, 100);
  return `${river} ${bird} ${number}`;
}

/**
 * SPEC.md §36 — a first-time member picks their own display alias from a
 * batch like this rather than having one silently assigned. Never checked
 * against the DB here (the caller does that); this only guarantees the
 * batch has no internal duplicates.
 */
export function generateDisplayAliasCandidates(count: number): string[] {
  const seen = new Set<string>();
  while (seen.size < count) {
    seen.add(generateDisplayAliasCandidate());
  }
  return [...seen];
}

/**
 * Guards `commitAlias` against a client sending back something that isn't
 * actually one of the offered candidates' shape — e.g. a name a member typed
 * in themselves, which would defeat the whole point of a closed, curated word
 * list (SPEC.md §36).
 */
export function isWellFormedDisplayAlias(candidate: string): boolean {
  const match = candidate.match(/^([A-Z-]+) ([A-Z-]+) (\d{1,2})$/);
  if (!match) return false;
  const [, river, bird, numberStr] = match;
  const number = Number(numberStr);
  return RIVERS.includes(river) && BIRDS.includes(bird) && number >= 1 && number <= 99;
}
