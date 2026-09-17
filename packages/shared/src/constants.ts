/**
 * LAW 3 — no aggregate may describe fewer than this many members.
 *
 * This is the DEFAULT and the production value. It is deliberately still a
 * constant, not an env read: every call site that doesn't explicitly thread a
 * floor through gets 50, so forgetting to configure something can never
 * silently lower the floor. Only `resolveKAnonFloor()` below reads the
 * environment, and only a deployment that sets K_ANON_FLOOR explicitly gets
 * anything other than 50.
 */
export const K_ANON_FLOOR = 50;

/**
 * Resolves the runtime k-anonymity floor for a non-production pilot/demo
 * deployment that needs a populated registry before real answering volume
 * exists. Production sets nothing and stays at 50.
 *
 * Fails CLOSED in every ambiguous case — missing, blank, non-numeric,
 * fractional, or < 1 all fall back to K_ANON_FLOOR rather than to something
 * permissive. A value ABOVE 50 is honoured (raising the floor is always safe);
 * a value below it is honoured too, but only because a human typed it.
 */
export function resolveKAnonFloor(env: Record<string, string | undefined> = {}): number {
  const raw = env.K_ANON_FLOOR?.trim();
  // A plain decimal integer and nothing else. Number() alone would accept
  // "1e3", " 0x20", and "Infinity" — all of which mean something, none of
  // which anyone configuring a k-anonymity floor intended to type.
  if (raw === undefined || !/^\d+$/.test(raw)) return K_ANON_FLOOR;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return K_ANON_FLOOR;
  return parsed;
}

/** True when the configured floor is weaker than LAW 3's production value. */
export function isRelaxedKAnonFloor(floor: number): boolean {
  return floor < K_ANON_FLOOR;
}

export const ZONE_LEVELS = ["village", "panchayat", "hobli", "constituency"] as const;
export type ZoneLevel = (typeof ZONE_LEVELS)[number];

export const INPUT_MODES = ["tap", "voice", "snap", "text"] as const;
export type InputMode = (typeof INPUT_MODES)[number];
