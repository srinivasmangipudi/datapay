import { K_ANON_FLOOR, ZONE_LEVELS, type ZoneLevel } from "./constants";

export interface ZoneNode {
  id: string;
  level: ZoneLevel;
  parentId: string | null;
}

/**
 * LAW 3 — walks village → panchayat → hobli → constituency, coarsening the zone
 * until `cohortSizeAt` reports a cohort >= K_ANON_FLOOR. Returns null if even the
 * constituency-level cohort can't clear the floor (aggregate must not be produced).
 */
export function coarsenZoneUntilKAnon(
  startZoneId: string,
  zonesById: Map<string, ZoneNode>,
  cohortSizeAt: (zoneId: string) => number
): { zoneId: string; level: ZoneLevel } | null {
  let current = zonesById.get(startZoneId);
  if (!current) return null;

  while (current) {
    if (cohortSizeAt(current.id) >= K_ANON_FLOOR) {
      return { zoneId: current.id, level: current.level };
    }
    if (!current.parentId) return null;
    current = zonesById.get(current.parentId);
  }
  return null;
}

export function meetsKAnonFloor(cohortSize: number): boolean {
  return cohortSize >= K_ANON_FLOOR;
}

export function nextCoarserLevel(level: ZoneLevel): ZoneLevel | null {
  const idx = ZONE_LEVELS.indexOf(level);
  return idx < ZONE_LEVELS.length - 1 ? ZONE_LEVELS[idx + 1] : null;
}
