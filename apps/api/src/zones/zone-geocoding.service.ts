import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { GeocodingProvider, NominatimGeocodingProvider } from "./geocoding.provider";
import { languageForState } from "./india-languages.util";

export interface ResolvedZone {
  id: string;
  name: string;
  nameKn: string | null;
  level: string;
  parentId: string | null;
}

export interface ResolveLocationResult {
  zone: ResolvedZone;
  matchType: "existing" | "created";
  geocodedLabel: string;
}

interface ZoneRow {
  id: string;
  name: string;
  name_kn: string | null;
  level: string;
  parent_id: string | null;
}

function toResolvedZone(row: ZoneRow): ResolvedZone {
  return { id: row.id, name: row.name, nameKn: row.name_kn, level: row.level, parentId: row.parent_id };
}

/**
 * SPEC.md §38 — "detect my location" / "enter my address" onboarding
 * fallback. Reverse/forward-geocodes to a real place; finds or creates the
 * REAL regional group first (by name, from the geocoder's own district/taluk
 * data — never by "whatever's nearest," which would silently misfile a
 * member into an unrelated region hundreds of km away just because it's the
 * only one that happens to exist yet). The village is then found or created
 * scoped INSIDE that region, not matched globally — so a same-named village
 * in a different real region never collides with this one.
 */
@Injectable()
export class ZoneGeocodingService {
  private geocoderInstance: GeocodingProvider | null = null;
  // Test-only seam — same shape as SnapsService.recognitionOverride.
  geocoderOverride: GeocodingProvider | null = null;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private get geocoder(): GeocodingProvider {
    if (this.geocoderOverride) return this.geocoderOverride;
    if (!this.geocoderInstance) {
      this.geocoderInstance = new NominatimGeocodingProvider();
    }
    return this.geocoderInstance;
  }

  async resolveFromCoordinates(lat: number, lng: number): Promise<ResolveLocationResult> {
    const place = await this.geocoder.reverseGeocode(lat, lng);
    if (!place) throw new BadRequestException("Couldn't determine a place for that location");
    return this.findOrCreateZone(
      place.placeName,
      place.regionName,
      languageForState(place.state),
      place.displayName,
      place.lat,
      place.lng
    );
  }

  async resolveFromAddress(address: string): Promise<ResolveLocationResult> {
    const place = await this.geocoder.forwardGeocode(address);
    if (!place) throw new BadRequestException("Couldn't find that address");
    return this.findOrCreateZone(
      place.placeName,
      place.regionName,
      languageForState(place.state),
      place.displayName,
      place.lat,
      place.lng
    );
  }

  private async findOrCreateZone(
    placeName: string | null,
    regionName: string | null,
    languageCode: string | null,
    displayName: string,
    lat: number,
    lng: number
  ): Promise<ResolveLocationResult> {
    if (!placeName) {
      throw new BadRequestException(
        "That location didn't resolve to a specific village — try a more precise address"
      );
    }
    if (!regionName) {
      throw new BadRequestException(
        "Couldn't determine the region for that location — try a more precise address"
      );
    }

    let regionCreated = false;
    const { rows: existingRegion } = await this.pool.query<ZoneRow>(
      `SELECT id, name, name_kn, level, parent_id FROM zones WHERE level = 'constituency' AND LOWER(name) = LOWER($1) LIMIT 1`,
      [regionName]
    );
    let regionZone: ZoneRow;
    if (existingRegion[0]) {
      regionZone = existingRegion[0];
    } else {
      // A real administrative name (district/taluk-equivalent — see
      // geocoding.provider.ts's regionName() for why this isn't literally an
      // Assembly Constituency), not a distance guess — flagged for review
      // since its centroid is only the first village's point, not a true
      // regional center.
      const { rows: createdRegion } = await this.pool.query<ZoneRow>(
        `INSERT INTO zones (name, level, centroid_lat, centroid_lng, needs_hierarchy_review, language_code)
         VALUES ($1, 'constituency', $2, $3, true, $4)
         RETURNING id, name, name_kn, level, parent_id`,
        [regionName, lat, lng, languageCode]
      );
      regionZone = createdRegion[0];
      regionCreated = true;
    }

    const { rows: existingVillage } = await this.pool.query<ZoneRow>(
      `SELECT id, name, name_kn, level, parent_id FROM zones
       WHERE level = 'village' AND parent_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [regionZone.id, placeName]
    );
    if (existingVillage[0]) {
      return {
        zone: toResolvedZone(existingVillage[0]),
        matchType: regionCreated ? "created" : "existing",
        geocodedLabel: displayName,
      };
    }

    const { rows: createdVillage } = await this.pool.query<ZoneRow>(
      `INSERT INTO zones (name, level, parent_id, centroid_lat, centroid_lng, needs_hierarchy_review, language_code)
       VALUES ($1, 'village', $2, $3, $4, true, $5)
       RETURNING id, name, name_kn, level, parent_id`,
      [placeName, regionZone.id, lat, lng, languageCode]
    );
    return { zone: toResolvedZone(createdVillage[0]), matchType: "created", geocodedLabel: displayName };
  }
}
