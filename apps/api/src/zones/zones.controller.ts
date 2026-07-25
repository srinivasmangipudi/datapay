import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ResolveLocationDtoSchema } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { AliasAuthGuard } from "../auth/alias-auth.guard";
import { parseOrThrow } from "../zod.util";
import { ZoneGeocodingService } from "./zone-geocoding.service";

interface ZoneRow {
  id: string;
  parent_id: string | null;
  level: string;
  name: string;
  name_kn: string | null;
}

@Controller("v1/zones")
export class ZonesController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly zoneGeocoding: ZoneGeocodingService
  ) {}

  @Get()
  async list() {
    const { rows } = await this.pool.query<ZoneRow>(
      `SELECT id, parent_id, level, name, name_kn FROM zones ORDER BY level, name`
    );
    return rows.map((z) => ({
      id: z.id,
      parentId: z.parent_id,
      level: z.level,
      name: z.name,
      nameKn: z.name_kn,
    }));
  }

  /**
   * SPEC.md §38 — onboarding fallback for "my village isn't listed."
   * Member-facing (a valid alias JWT already exists by this point in
   * onboarding, per the OTP-verify/commit-alias step). Geocodes the given
   * location or address to a real place; matches an existing zone by name,
   * or creates one on the spot (flagged for hierarchy review) rather than
   * forcing the member onto an unrelated "nearest" village.
   */
  @Post("resolve-location")
  @UseGuards(AliasAuthGuard)
  async resolveLocation(@Body() body: unknown) {
    const dto = parseOrThrow(ResolveLocationDtoSchema, body);
    return "lat" in dto
      ? this.zoneGeocoding.resolveFromCoordinates(dto.lat, dto.lng)
      : this.zoneGeocoding.resolveFromAddress(dto.address);
  }
}
