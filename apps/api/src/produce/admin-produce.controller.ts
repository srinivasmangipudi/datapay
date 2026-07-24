import { Controller, Get, Inject, Query } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

// Same deliberately-deferred-auth posture as every other admin endpoint
// (SPEC.md §19E) — an ops-wide view across every producer's listings,
// unlike ProduceController's alias-scoped member routes.
@Controller("v1/admin/produce-listings")
export class AdminProduceController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async list(@Query("state") state?: string) {
    const { rows } = await this.pool.query(
      `SELECT l.id, l.alias_id, l.qty, l.unit, l.state, l.asking_price_paise, l.created_at,
              pc.name AS category_name, m.zone_id, z.name AS zone_name,
              (SELECT COUNT(*) FROM linkages lk WHERE lk.listing_id = l.id) AS linkage_count,
              (SELECT lk.state FROM linkages lk WHERE lk.listing_id = l.id ORDER BY lk.created_at DESC LIMIT 1) AS latest_linkage_state
       FROM produce_listings l
       JOIN produce_categories pc ON pc.id = l.produce_category_id
       JOIN members m ON m.alias_id = l.alias_id
       LEFT JOIN zones z ON z.id = m.zone_id
       ${state ? "WHERE l.state = $1" : ""}
       ORDER BY l.created_at DESC
       LIMIT 200`,
      state ? [state] : []
    );
    return rows;
  }
}
