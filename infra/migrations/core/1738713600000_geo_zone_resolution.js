export const shorthands = undefined;

// A minimal, real "GIS" capability (SPEC.md §35): resolve a member's GPS
// reading to the nearest zone by centroid distance. No boundary polygon data
// exists yet (bharatatlas.com, the source floated earlier, turned out to be
// unreachable/unverifiable when checked) — centroid-nearest is the honest
// MVP, not a placeholder pretending to be more precise than it is.
export const up = (pgm) => {
  pgm.addColumn("zones", {
    centroid_lat: { type: "numeric" },
    centroid_lng: { type: "numeric" },
  });

  // The zone resolved from GPS captured AT ANSWER TIME — deliberately
  // separate from members.zone_id (the zone chosen once at onboarding).
  // Raw coordinates are never persisted anywhere, only this resolved
  // reference (SPEC.md §35 — a deliberate LAW 1 boundary, not an oversight).
  pgm.addColumn("responses", {
    zone_id: { type: "uuid", references: "zones", onDelete: "set null" },
  });
  pgm.createIndex("responses", "zone_id");
};

export const down = (pgm) => {
  pgm.dropColumn("responses", "zone_id");
  pgm.dropColumn("zones", ["centroid_lat", "centroid_lng"]);
};
