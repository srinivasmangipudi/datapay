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
