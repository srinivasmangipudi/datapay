import { describe, expect, it } from "vitest";
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
