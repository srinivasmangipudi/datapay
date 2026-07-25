import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

// Genuinely public, by design — not the "unauthenticated for now" posture
// §19E gives every /v1/admin/* endpoint. Every row here already cleared
// LAW 3's k-anonymity floor before it could exist at all (demand_aggregates'
// own CHECK constraint), so there's nothing here for auth to protect.
@Injectable()
export class PublicService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getRegistry() {
    const { rows: registry } = await this.pool.query(
      `SELECT da.id, c.name AS category_name, z.name AS zone_name, z.level AS zone_level,
              da.cohort_size, da.computed_at
       FROM demand_aggregates da
       JOIN categories c ON c.id = da.category_id
       JOIN zones z ON z.id = da.zone_id
       ORDER BY da.computed_at DESC
       LIMIT 200`
    );

    // "Opportunities" (SPEC.md §29) — real, published demand with no open
    // offer serving it yet. Never leaks a supplier's negotiated pricing
    // (offers.collective_price_paise/market_price_paise) — only whether one
    // exists at all, same aggregate-only posture as the registry itself.
    const { rows: opportunities } = await this.pool.query(
      `SELECT da.id, c.name AS category_name, z.name AS zone_name, z.level AS zone_level,
              da.cohort_size, da.computed_at
       FROM demand_aggregates da
       JOIN categories c ON c.id = da.category_id
       JOIN zones z ON z.id = da.zone_id
       WHERE NOT EXISTS (
         SELECT 1 FROM offers o
         JOIN products p ON p.product_code = o.product_code
         WHERE p.category_id = da.category_id AND o.zone_id = da.zone_id AND o.status = 'open'
       )
       ORDER BY da.cohort_size DESC
       LIMIT 100`
    );

    return { registry, opportunities };
  }
}
