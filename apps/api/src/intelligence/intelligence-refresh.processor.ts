import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import { Job } from "bullmq";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { IntelligenceSourcesService } from "./intelligence-sources.service";
import { ZoneUnderstandingService } from "./zone-understanding.service";

export const INTELLIGENCE_REFRESH_QUEUE = "intelligence-refresh";

// Keeps every zone's intelligence current without a human clicking "Sync"/
// "Refresh" (SPEC.md §24) — syncs every connected source, then rebuilds every
// zone's understanding from whatever that sync produced. One source or zone
// failing (revoked Drive sharing, no documents yet) must never block the
// others in the same run.
@Processor(INTELLIGENCE_REFRESH_QUEUE)
export class IntelligenceRefreshProcessor extends WorkerHost {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly sources: IntelligenceSourcesService,
    private readonly understanding: ZoneUnderstandingService
  ) {
    super();
  }

  async process(_job: Job) {
    const { rows: sourceRows } = await this.pool.query<{ id: number }>(
      `SELECT id FROM intelligence_sources`
    );
    for (const { id } of sourceRows) {
      try {
        await this.sources.sync(id);
      } catch {
        // Surfaced to ops already via that source's own last-synced state in
        // the portal — one bad source shouldn't stop every other sync.
      }
    }

    const { rows: zoneRows } = await this.pool.query<{ zone_id: string }>(
      `SELECT DISTINCT zone_id FROM intelligence_sources`
    );
    for (const { zone_id } of zoneRows) {
      try {
        await this.understanding.refresh(zone_id);
      } catch {
        // Same reasoning — e.g. a zone with sources connected but nothing
        // ingested yet shouldn't stop other zones from refreshing.
      }
    }
  }
}
