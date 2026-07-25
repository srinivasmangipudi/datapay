import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

// No real boundary-polygon data exists yet (SPEC.md §35 — bharatatlas.com
// was checked and turned out unreachable/unverifiable). Nearest-centroid is
// the honest MVP: a zone with an admin-set representative point wins if it's
// the closest one to the reading, capped at a sanity radius so a GPS glitch
// (or a reading from somewhere else entirely) never gets force-matched to
// whatever pilot zone happens to be nearest on the whole planet.
const MAX_MATCH_RADIUS_KM = 50;
const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

@Injectable()
export class ZoneResolverService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Returns the nearest zone with a centroid set, or null if none exists
   * within MAX_MATCH_RADIUS_KM (including the common case today: no zone
   * has a centroid at all yet). Never throws on a bad reading — resolution
   * failing just means the response's zone_id stays null, not a rejected answer.
   */
  async resolveNearestZone(lat: number, lng: number): Promise<string | null> {
    const nearest = await this.findNearest(lat, lng);
    return nearest && nearest.distanceKm <= MAX_MATCH_RADIUS_KM ? nearest.id : null;
  }

  private async findNearest(lat: number, lng: number): Promise<{ id: string; distanceKm: number } | null> {
    const { rows } = await this.pool.query<{ id: string; centroid_lat: string; centroid_lng: string }>(
      `SELECT id, centroid_lat, centroid_lng FROM zones
       WHERE centroid_lat IS NOT NULL AND centroid_lng IS NOT NULL`
    );
    if (rows.length === 0) return null;

    let nearestId: string | null = null;
    let nearestKm = Infinity;
    for (const zone of rows) {
      const distanceKm = haversineKm(lat, lng, Number(zone.centroid_lat), Number(zone.centroid_lng));
      if (distanceKm < nearestKm) {
        nearestKm = distanceKm;
        nearestId = zone.id;
      }
    }
    return nearestId ? { id: nearestId, distanceKm: nearestKm } : null;
  }
}
