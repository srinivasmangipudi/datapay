import { Controller, Get, Inject, Query } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

// Same deliberately-deferred-auth posture as every other admin endpoint
// (SPEC.md §19E). Alias-only throughout — LAW 1 holds here same as anywhere
// else in core_db.
@Controller("v1/admin")
export class AdminFraudController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get("quality-flags")
  async listQualityFlags(@Query("aliasId") aliasId?: string) {
    const { rows } = await this.pool.query(
      aliasId
        ? `SELECT id, alias_id, rule, detail, at FROM quality_flags WHERE alias_id = $1 ORDER BY at DESC LIMIT 200`
        : `SELECT id, alias_id, rule, detail, at FROM quality_flags ORDER BY at DESC LIMIT 200`,
      aliasId ? [aliasId] : []
    );
    return rows;
  }

  @Get("trust-scores")
  async listTrustScores() {
    const { rows } = await this.pool.query(
      `SELECT alias_id, display_alias, trust_score,
              (SELECT COUNT(*) FROM quality_flags qf WHERE qf.alias_id = m.alias_id) AS flag_count
       FROM members m
       ORDER BY trust_score ASC, alias_id
       LIMIT 200`
    );
    return rows;
  }
}
