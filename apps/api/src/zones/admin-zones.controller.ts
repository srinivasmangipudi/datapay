import { Body, Controller, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { CreateZoneDtoSchema, UpdateZoneCentroidDtoSchema, UpdateZoneLanguageDtoSchema } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { parseOrThrow } from "../zod.util";

@Controller("v1/admin/zones")
export class AdminZonesController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Post()
  async create(@Body() body: unknown) {
    const dto = parseOrThrow(CreateZoneDtoSchema, body);
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO zones (name, name_kn, level, parent_id, centroid_lat, centroid_lng, language_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        dto.name,
        dto.nameKn ?? null,
        dto.level,
        dto.parentId ?? null,
        dto.centroidLat ?? null,
        dto.centroidLng ?? null,
        dto.languageCode ?? null,
      ]
    );
    return { id: rows[0].id };
  }

  // Sets/corrects an existing zone's centroid (SPEC.md §35) — separate from
  // a general zone-edit endpoint, since a centroid is the one field a zone
  // created before this addendum existed genuinely needs filled in after the fact.
  @Patch(":id")
  async updateCentroid(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = parseOrThrow(UpdateZoneCentroidDtoSchema, body);
    const { rows } = await this.pool.query<{ id: string }>(
      `UPDATE zones SET centroid_lat = $1, centroid_lng = $2 WHERE id = $3 RETURNING id`,
      [dto.centroidLat, dto.centroidLng, id]
    );
    if (!rows[0]) throw new NotFoundException("Zone not found");
    return { id: rows[0].id };
  }

  // SPEC.md §39 — a manually-created zone (or one geocoded before this
  // addendum existed) has no language_code yet; ops sets or corrects it here.
  @Patch(":id/language")
  async updateLanguage(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dto = parseOrThrow(UpdateZoneLanguageDtoSchema, body);
    const { rows } = await this.pool.query<{ id: string }>(
      `UPDATE zones SET language_code = $1 WHERE id = $2 RETURNING id`,
      [dto.languageCode, id]
    );
    if (!rows[0]) throw new NotFoundException("Zone not found");
    return { id: rows[0].id };
  }
}
