/** LAW 3 — no aggregate may describe fewer than this many members. */
export const K_ANON_FLOOR = 50;

export const ZONE_LEVELS = ["village", "panchayat", "hobli", "constituency"] as const;
export type ZoneLevel = (typeof ZONE_LEVELS)[number];

export const INPUT_MODES = ["tap", "voice", "snap"] as const;
export type InputMode = (typeof INPUT_MODES)[number];
