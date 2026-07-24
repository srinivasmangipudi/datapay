import { Body, Controller, Inject, Post } from "@nestjs/common";
import { CreateZoneDtoSchema } from "@datapay/shared";
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
      `INSERT INTO zones (name, name_kn, level, parent_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [dto.name, dto.nameKn ?? null, dto.level, dto.parentId ?? null]
    );
    return { id: rows[0].id };
  }
}
