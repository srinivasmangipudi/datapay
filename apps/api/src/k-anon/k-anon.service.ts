import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { isRelaxedKAnonFloor, K_ANON_FLOOR, resolveKAnonFloor } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

/**
 * LAW 3's floor, resolved once at boot and mirrored into the database.
 *
 * Two enforcement points have to agree on the same number or every insert
 * fails: the aggregation job (which decides what to compute) and the
 * `enforce_k_anon_floor()` trigger (which decides what may exist). The
 * environment is the single source of truth; this service pushes it into
 * `system_settings` at startup so the trigger enforces exactly what the job
 * was configured with, rather than the two drifting apart silently.
 *
 * Production sets no K_ANON_FLOOR and both stay at 50.
 */
@Injectable()
export class KAnonService implements OnModuleInit {
  private readonly logger = new Logger(KAnonService.name);
  private readonly floor = resolveKAnonFloor(process.env);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    await this.pool.query(
      `UPDATE system_settings SET k_anon_floor = $1, updated_at = now() WHERE id = 1`,
      [this.floor]
    );

    if (isRelaxedKAnonFloor(this.floor)) {
      // Loud on purpose. A deployment running below 50 is publishing
      // aggregates that LAW 3 would not permit in production, and that fact
      // should be impossible to miss in a log — it is also surfaced to the
      // public page itself, which labels the data as pilot data.
      this.logger.warn(
        `K_ANON_FLOOR is set to ${this.floor}, BELOW LAW 3's production floor of ${K_ANON_FLOOR}. ` +
          `Published aggregates may describe cohorts smaller than 50 members. ` +
          `This must never be the case in production.`
      );
    } else {
      this.logger.log(`k-anonymity floor: ${this.floor}`);
    }
  }

  getFloor(): number {
    return this.floor;
  }

  isRelaxed(): boolean {
    return isRelaxedKAnonFloor(this.floor);
  }
}
