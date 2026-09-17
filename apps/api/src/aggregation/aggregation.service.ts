import { Inject, Injectable } from "@nestjs/common";
import { coarsenZoneUntilKAnon, meetsKAnonFloor, type ZoneNode } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { KAnonService } from "../k-anon/k-anon.service";

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

/** A question eligible for public per-question publication (SPEC.md §43). */
interface PublishableQuestion {
  id: number;
  type: string;
  category_kind: string;
}

type OptionCountRow = {
  question_id: number;
  ancestor_id: string;
  label_en: string;
  sort: number;
  n: string;
};

type NumericStatRow = {
  question_id: number;
  ancestor_id: string;
  n: string;
  mean: string;
  median: string;
  min: string;
  max: string;
};

/** The published shape of a single question's answers — see the migration. */
export type Distribution =
  | { kind: "options"; total: number; options: Array<{ label: string; count: number; pct: number }> }
  | { kind: "numeric"; count: number; mean: number; median: number; min: number; max: number };

// A recursive zone rollup used by three separate queries below — every one of
// them needs "this zone plus everything under it", and writing it three times
// is how the three quietly stop agreeing with each other.
const DESCENDANTS_CTE = `
  WITH RECURSIVE descendants AS (
    SELECT id AS ancestor_id, id AS descendant_id FROM zones
    UNION ALL
    SELECT d.ancestor_id, z.id FROM zones z JOIN descendants d ON z.parent_id = d.descendant_id
  )`;

// SPEC.md §6A — computes demand_aggregates from responses, coarsening zones
// with the SAME pure function packages/shared already ships and unit-tests
// (coarsenZoneUntilKAnon). LAW 3 enforced here (job) AND at the database
// (the enforce_k_anon_floor() trigger) — either failing closed is enough.
@Injectable()
export class AggregationService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly kAnon: KAnonService
  ) {}

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
      `${DESCENDANTS_CTE}
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
    const floor = this.kAnon.getFloor();
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
      const result = coarsenZoneUntilKAnon(zone_id, zonesById, cohortSizeAt, floor);
      if (!result || seen.has(result.zoneId)) {
        if (!result) suppressed++;
        continue;
      }
      seen.add(result.zoneId);

      const cohortSize = cohortSizeAt(result.zoneId);
      if (!meetsKAnonFloor(cohortSize, floor)) {
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

  // ---------------------------------------------------------------------
  // Per-question publication (SPEC.md §43) — what the public registry's two
  // buckets are actually built from.
  // ---------------------------------------------------------------------

  /**
   * Questions whose answers may be published at all.
   *
   * free_text is excluded here and nowhere else needs to know: an open-ended
   * answer in a member's own words is re-identifying no matter how large the
   * cohort around it is, so k-anonymity is simply the wrong control for it.
   * Unpublished categories (test fixtures, and anything ops has parked) are
   * excluded for the ordinary reason.
   */
  private async loadPublishableQuestions(): Promise<PublishableQuestion[]> {
    const { rows } = await this.pool.query<PublishableQuestion>(
      `SELECT q.id, q.type, c.kind AS category_kind
       FROM questions q
       JOIN categories c ON c.id = q.category_id
       WHERE q.review_state = 'approved'
         AND c.published = true
         AND q.type <> 'free_text'`
    );
    return rows;
  }

  /** question_id → zone_id → distinct members who answered that question there. */
  private async computeQuestionCohorts(): Promise<Map<number, Map<string, number>>> {
    const { rows } = await this.pool.query<{
      question_id: number;
      ancestor_id: string;
      cohort_size: string;
    }>(
      `${DESCENDANTS_CTE}
       SELECT r.question_id, d.ancestor_id, COUNT(DISTINCT r.alias_id) AS cohort_size
       FROM descendants d
       JOIN members m ON m.zone_id = d.descendant_id
       JOIN responses r ON r.alias_id = m.alias_id
       GROUP BY r.question_id, d.ancestor_id`
    );
    const byQuestion = new Map<number, Map<string, number>>();
    for (const r of rows) {
      let zones = byQuestion.get(r.question_id);
      if (!zones) {
        zones = new Map<string, number>();
        byQuestion.set(r.question_id, zones);
      }
      zones.set(r.ancestor_id, Number(r.cohort_size));
    }
    return byQuestion;
  }

  /**
   * Every option tally for every question × zone, in one pass.
   *
   * Deliberately one query rather than one per question × zone: the previous
   * shape (computeMetric) issues a recursive CTE per aggregate, which is fine
   * for ~17 categories and quadratic for ~50 questions across every zone.
   */
  private async computeOptionCounts(): Promise<Map<string, OptionCountRow[]>> {
    const { rows } = await this.pool.query<OptionCountRow>(
      `${DESCENDANTS_CTE}
       SELECT r.question_id, d.ancestor_id, o.label_en, o.sort, COUNT(DISTINCT r.alias_id) AS n
       FROM descendants d
       JOIN members m ON m.zone_id = d.descendant_id
       JOIN responses r ON r.alias_id = m.alias_id
       JOIN question_options o ON o.id = ANY(r.option_ids) AND o.question_id = r.question_id
       GROUP BY r.question_id, d.ancestor_id, o.label_en, o.sort`
    );
    const map = new Map<string, OptionCountRow[]>();
    for (const r of rows) {
      const key = `${r.question_id}:${r.ancestor_id}`;
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return map;
  }

  /** Summary statistics for numeric questions, same one-pass shape. */
  private async computeNumericStats(): Promise<Map<string, NumericStatRow>> {
    const { rows } = await this.pool.query<NumericStatRow>(
      `${DESCENDANTS_CTE}
       SELECT r.question_id, d.ancestor_id,
              COUNT(*) AS n,
              AVG(r.numeric_value) AS mean,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.numeric_value) AS median,
              MIN(r.numeric_value) AS min,
              MAX(r.numeric_value) AS max
       FROM descendants d
       JOIN members m ON m.zone_id = d.descendant_id
       JOIN responses r ON r.alias_id = m.alias_id
       WHERE r.numeric_value IS NOT NULL
       GROUP BY r.question_id, d.ancestor_id`
    );
    const map = new Map<string, NumericStatRow>();
    for (const r of rows) map.set(`${r.question_id}:${r.ancestor_id}`, r);
    return map;
  }

  private buildDistribution(
    question: PublishableQuestion,
    zoneId: string,
    cohortSize: number,
    optionCounts: Map<string, OptionCountRow[]>,
    numericStats: Map<string, NumericStatRow>
  ): Distribution | null {
    const key = `${question.id}:${zoneId}`;

    if (question.type === "numeric") {
      const stat = numericStats.get(key);
      if (!stat) return null;
      return {
        kind: "numeric",
        count: Number(stat.n),
        mean: Number(stat.mean),
        median: Number(stat.median),
        min: Number(stat.min),
        max: Number(stat.max),
      };
    }

    const counts = optionCounts.get(key);
    if (!counts || counts.length === 0) return null;
    return {
      kind: "options",
      total: cohortSize,
      options: counts
        .sort((a, b) => a.sort - b.sort || a.label_en.localeCompare(b.label_en))
        .map((c) => ({
          label: c.label_en,
          count: Number(c.n),
          // Share of the whole cohort, not of answers given. On a `multi`
          // question these deliberately sum past 100% — a household that picks
          // three pulses is in three buckets, and renormalising that to 100%
          // would misreport "48% of households stock toor" as something else.
          pct: cohortSize > 0 ? Math.round((Number(c.n) / cohortSize) * 1000) / 10 : 0,
        })),
    };
  }

  /**
   * Publishes one row per question × coarsened zone into
   * question_stat_aggregates, upserting so a re-run refreshes in place.
   */
  async runQuestionStats(windowLabel = "rolling"): Promise<AggregationRunResult> {
    const floor = this.kAnon.getFloor();
    const zonesById = await this.loadZoneMap();
    const questions = await this.loadPublishableQuestions();
    const cohortsByQuestion = await this.computeQuestionCohorts();
    const optionCounts = await this.computeOptionCounts();
    const numericStats = await this.computeNumericStats();

    const { rows: answeredZones } = await this.pool.query<{
      question_id: number;
      zone_id: string;
    }>(
      `SELECT DISTINCT r.question_id, m.zone_id
       FROM responses r JOIN members m ON m.alias_id = r.alias_id`
    );
    const leafZonesByQuestion = new Map<number, string[]>();
    for (const r of answeredZones) {
      const list = leafZonesByQuestion.get(r.question_id);
      if (list) list.push(r.zone_id);
      else leafZonesByQuestion.set(r.question_id, [r.zone_id]);
    }

    let published = 0;
    let suppressed = 0;

    for (const question of questions) {
      const cohorts = cohortsByQuestion.get(question.id) ?? new Map<string, number>();
      const cohortSizeAt = (zoneId: string) => cohorts.get(zoneId) ?? 0;
      const seen = new Set<string>();

      for (const leafZoneId of leafZonesByQuestion.get(question.id) ?? []) {
        const coarsened = coarsenZoneUntilKAnon(leafZoneId, zonesById, cohortSizeAt, floor);
        if (!coarsened) {
          suppressed++;
          continue;
        }
        if (seen.has(coarsened.zoneId)) continue;
        seen.add(coarsened.zoneId);

        const cohortSize = cohortSizeAt(coarsened.zoneId);
        if (!meetsKAnonFloor(cohortSize, floor)) {
          suppressed++;
          continue;
        }

        const distribution = this.buildDistribution(
          question,
          coarsened.zoneId,
          cohortSize,
          optionCounts,
          numericStats
        );
        // A question whose cohort cleared the floor but which produced no
        // tallies at all (every answer in it was supplementary text, say) has
        // nothing to publish — that's not suppression, it's absence.
        if (!distribution) continue;

        await this.pool.query(
          `INSERT INTO question_stat_aggregates
             (question_id, zone_id, "window", distribution, cohort_size, computed_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (question_id, zone_id, "window")
           DO UPDATE SET distribution = EXCLUDED.distribution,
                         cohort_size = EXCLUDED.cohort_size,
                         computed_at = EXCLUDED.computed_at`,
          [question.id, coarsened.zoneId, windowLabel, distribution, cohortSize]
        );
        published++;
      }
    }

    return { published, suppressed };
  }
}
