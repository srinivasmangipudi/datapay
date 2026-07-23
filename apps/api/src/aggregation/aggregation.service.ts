import { Inject, Injectable } from "@nestjs/common";
import { coarsenZoneUntilKAnon, meetsKAnonFloor, type ZoneNode } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

interface ZoneRow {
  id: string;
  parent_id: string | null;
  level: string;
}

interface CohortRow {
  ancestor_id: string;
  cohort_size: string;
}

export interface AggregationRunResult {
  published: number;
  suppressed: number;
}

// SPEC.md §6A — computes demand_aggregates from responses, coarsening zones
// with the SAME pure function packages/shared already ships and unit-tests
// (coarsenZoneUntilKAnon). LAW 3 enforced here (job) AND at the database
// (demand_aggregates.cohort_size CHECK >= 50) — either failing closed is enough.
@Injectable()
export class AggregationService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async loadZoneMap(): Promise<Map<string, ZoneNode>> {
    const { rows } = await this.pool.query<ZoneRow>(`SELECT id, parent_id, level FROM zones`);
    const map = new Map<string, ZoneNode>();
    for (const r of rows) {
      map.set(r.id, { id: r.id, level: r.level as ZoneNode["level"], parentId: r.parent_id });
    }
    return map;
  }

  // For every zone, counts distinct aliases (among members whose zone is that
  // zone OR any descendant) who answered a question in this category — i.e.
  // exactly the cohortSizeAt() the pure coarsening function needs, precomputed
  // synchronously since coarsenZoneUntilKAnon's callback isn't async.
  private async computeCohortSizes(categoryId: number): Promise<Map<string, number>> {
    const { rows } = await this.pool.query<CohortRow>(
      `WITH RECURSIVE descendants AS (
         SELECT id AS ancestor_id, id AS descendant_id FROM zones
         UNION ALL
         SELECT d.ancestor_id, z.id FROM zones z JOIN descendants d ON z.parent_id = d.descendant_id
       )
       SELECT d.ancestor_id, COUNT(DISTINCT r.alias_id) AS cohort_size
       FROM descendants d
       JOIN members m ON m.zone_id = d.descendant_id
       JOIN responses r ON r.alias_id = m.alias_id
       JOIN questions q ON q.id = r.question_id AND q.category_id = $1
       GROUP BY d.ancestor_id`,
      [categoryId]
    );
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.ancestor_id, Number(r.cohort_size));
    return map;
  }

  private async computeMetric(categoryId: number, zoneId: string) {
    const { rows } = await this.pool.query<{ label_en: string | null; n: string }>(
      `WITH RECURSIVE descendants AS (
         SELECT id FROM zones WHERE id = $2
         UNION ALL
         SELECT z.id FROM zones z JOIN descendants d ON z.parent_id = d.id
       )
       SELECT o.label_en, COUNT(DISTINCT r.alias_id) AS n
       FROM responses r
       JOIN members m ON m.alias_id = r.alias_id
       JOIN questions q ON q.id = r.question_id AND q.category_id = $1
       LEFT JOIN question_options o ON o.id = ANY(r.option_ids)
       WHERE m.zone_id IN (SELECT id FROM descendants)
       GROUP BY o.label_en`,
      [categoryId, zoneId]
    );
    return {
      optionCounts: rows
        .filter((r) => r.label_en !== null)
        .map((r) => ({ label: r.label_en, count: Number(r.n) })),
    };
  }

  async runForCategory(categoryId: number, windowLabel = "rolling"): Promise<AggregationRunResult> {
    const zonesById = await this.loadZoneMap();
    const cohortSizes = await this.computeCohortSizes(categoryId);
    const cohortSizeAt = (zoneId: string) => cohortSizes.get(zoneId) ?? 0;

    const { rows: leafZones } = await this.pool.query<{ zone_id: string }>(
      `SELECT DISTINCT m.zone_id FROM members m
       JOIN responses r ON r.alias_id = m.alias_id
       JOIN questions q ON q.id = r.question_id AND q.category_id = $1`,
      [categoryId]
    );

    const seen = new Set<string>();
    let published = 0;
    let suppressed = 0;

    for (const { zone_id } of leafZones) {
      const result = coarsenZoneUntilKAnon(zone_id, zonesById, cohortSizeAt);
      if (!result || seen.has(result.zoneId)) {
        if (!result) suppressed++;
        continue;
      }
      seen.add(result.zoneId);

      const cohortSize = cohortSizeAt(result.zoneId);
      if (!meetsKAnonFloor(cohortSize)) {
        // Should be unreachable (coarsenZoneUntilKAnon already checked this),
        // kept as the belt half of belt-and-suspenders.
        suppressed++;
        continue;
      }

      const metric = await this.computeMetric(categoryId, result.zoneId);
      await this.pool.query(
        `INSERT INTO demand_aggregates (category_id, zone_id, "window", metric, cohort_size)
         VALUES ($1, $2, $3, $4, $5)`,
        [categoryId, result.zoneId, windowLabel, metric, cohortSize]
      );
      published++;
    }

    return { published, suppressed };
  }

  async runForAllCategories(): Promise<Record<string, AggregationRunResult>> {
    const { rows } = await this.pool.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM categories`
    );
    const results: Record<string, AggregationRunResult> = {};
    for (const c of rows) {
      results[c.slug] = await this.runForCategory(c.id);
    }
    return results;
  }
}
