import { K_ANON_FLOOR, ZONE_LEVELS, type ZoneLevel } from "./constants";

export interface ZoneNode {
  id: string;
  level: ZoneLevel;
  parentId: string | null;
}

/**
 * LAW 3 — walks village → panchayat → hobli → constituency, coarsening the zone
 * until `cohortSizeAt` reports a cohort >= `floor`. Returns null if even the
 * constituency-level cohort can't clear it (aggregate must not be produced).
 *
 * `floor` defaults to K_ANON_FLOOR so an un-updated caller keeps production
 * behaviour; only a caller that deliberately threads a configured floor
 * through gets anything else.
 */
export function coarsenZoneUntilKAnon(
  startZoneId: string,
  zonesById: Map<string, ZoneNode>,
  cohortSizeAt: (zoneId: string) => number,
  floor: number = K_ANON_FLOOR
): { zoneId: string; level: ZoneLevel } | null {
  let current = zonesById.get(startZoneId);
  if (!current) return null;

  while (current) {
    if (cohortSizeAt(current.id) >= floor) {
      return { zoneId: current.id, level: current.level };
    }
    if (!current.parentId) return null;
    current = zonesById.get(current.parentId);
  }
  return null;
}

export function meetsKAnonFloor(cohortSize: number, floor: number = K_ANON_FLOOR): boolean {
  return cohortSize >= floor;
}

export function nextCoarserLevel(level: ZoneLevel): ZoneLevel | null {
  const idx = ZONE_LEVELS.indexOf(level);
  return idx < ZONE_LEVELS.length - 1 ? ZONE_LEVELS[idx + 1] : null;
}
