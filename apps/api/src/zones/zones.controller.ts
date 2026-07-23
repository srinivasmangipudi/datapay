import { Controller, Get, Inject } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

interface ZoneRow {
  id: string;
  parent_id: string | null;
  level: string;
  name: string;
  name_kn: string | null;
}

@Controller("v1/zones")
export class ZonesController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

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
}
