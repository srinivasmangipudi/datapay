import { describe, expect, it } from "vitest";
import { isRelaxedKAnonFloor, resolveKAnonFloor } from "../constants";
import { coarsenZoneUntilKAnon, meetsKAnonFloor, type ZoneNode } from "../k-anon";

const zones = new Map<string, ZoneNode>([
  ["village-1", { id: "village-1", level: "village", parentId: "panchayat-1" }],
  ["panchayat-1", { id: "panchayat-1", level: "panchayat", parentId: "hobli-1" }],
  ["hobli-1", { id: "hobli-1", level: "hobli", parentId: "constituency-1" }],
  ["constituency-1", { id: "constituency-1", level: "constituency", parentId: null }],
]);

describe("meetsKAnonFloor", () => {
  it("rejects cohorts below 50", () => {
    expect(meetsKAnonFloor(49)).toBe(false);
    expect(meetsKAnonFloor(50)).toBe(true);
  });
});

describe("coarsenZoneUntilKAnon", () => {
  it("returns the village itself when it already clears the floor", () => {
    const result = coarsenZoneUntilKAnon("village-1", zones, () => 60);
    expect(result).toEqual({ zoneId: "village-1", level: "village" });
  });

  it("coarsens up to hobli when village and panchayat are too small", () => {
    const cohortSizes: Record<string, number> = {
      "village-1": 5,
      "panchayat-1": 20,
      "hobli-1": 80,
    };
    const result = coarsenZoneUntilKAnon(
      "village-1",
      zones,
      (zoneId) => cohortSizes[zoneId] ?? 0
    );
    expect(result).toEqual({ zoneId: "hobli-1", level: "hobli" });
  });

  it("returns null when even the constituency cannot clear the floor", () => {
    const result = coarsenZoneUntilKAnon("village-1", zones, () => 10);
    expect(result).toBeNull();
  });
});

describe("resolveKAnonFloor — fails closed on anything ambiguous", () => {
  it("defaults to 50 when nothing is configured", () => {
    expect(resolveKAnonFloor({})).toBe(50);
    expect(resolveKAnonFloor()).toBe(50);
  });

  it("falls back to 50 rather than to something permissive on junk input", () => {
    for (const raw of ["", "   ", "abc", "0", "-5", "2.5", "1e3", "NaN", "Infinity"]) {
      expect(resolveKAnonFloor({ K_ANON_FLOOR: raw })).toBe(50);
    }
  });

  it("honours an explicit lower floor — a pilot deployment's whole purpose", () => {
    expect(resolveKAnonFloor({ K_ANON_FLOOR: "5" })).toBe(5);
    expect(isRelaxedKAnonFloor(5)).toBe(true);
  });

  it("honours an explicit higher floor, which is never a relaxation", () => {
    expect(resolveKAnonFloor({ K_ANON_FLOOR: "200" })).toBe(200);
    expect(isRelaxedKAnonFloor(200)).toBe(false);
    expect(isRelaxedKAnonFloor(50)).toBe(false);
  });
});

describe("the configured floor is what actually gates publication", () => {
  it("meetsKAnonFloor still defaults to 50 for un-updated callers", () => {
    expect(meetsKAnonFloor(49)).toBe(false);
    expect(meetsKAnonFloor(50)).toBe(true);
  });

  it("meetsKAnonFloor respects an explicit floor in both directions", () => {
    expect(meetsKAnonFloor(4, 5)).toBe(false);
    expect(meetsKAnonFloor(5, 5)).toBe(true);
    expect(meetsKAnonFloor(60, 100)).toBe(false);
  });

  it("coarsens less aggressively under a lower floor", () => {
    const cohortSizes: Record<string, number> = {
      "village-1": 5,
      "panchayat-1": 20,
      "hobli-1": 80,
    };
    const at = (zoneId: string) => cohortSizes[zoneId] ?? 0;

    // At 50 the village and panchayat are both too small — this is the
    // existing behaviour, asserted here so a floor change can't silently
    // alter it.
    expect(coarsenZoneUntilKAnon("village-1", zones, at, 50)).toEqual({
      zoneId: "hobli-1",
      level: "hobli",
    });
    // At 5 the village itself already clears, so nothing is coarsened away —
    // which is precisely why a low floor publishes finer-grained geography.
    expect(coarsenZoneUntilKAnon("village-1", zones, at, 5)).toEqual({
      zoneId: "village-1",
      level: "village",
    });
  });

  it("still returns null when even the coarsest zone can't clear the floor", () => {
    expect(coarsenZoneUntilKAnon("village-1", zones, () => 10, 50)).toBeNull();
  });
});
