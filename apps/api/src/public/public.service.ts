import { Inject, Injectable } from "@nestjs/common";
import { K_ANON_FLOOR } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { KAnonService } from "../k-anon/k-anon.service";

export interface RegistryRow {
  id: number;
  category_name: string;
  zone_name: string;
  zone_level: string;
  cohort_size: number;
  computed_at: string;
}

export interface PublishedQuestion {
  question_id: number;
  text: string;
  type: string;
  cohort_size: number;
  distribution: unknown;
  computed_at: string;
}

/** One category × zone card, with every published question under it. */
export interface DemandGroup {
  category_id: number;
  category_slug: string;
  category_name: string;
  zone_id: string;
  zone_name: string;
  zone_level: string;
  /** Largest cohort across this group's questions — the group's headline number. */
  households: number;
  /** Households declaring intent to buy, across this group's intent_window questions. */
  intending: number | null;
  has_open_offer: boolean;
  questions: PublishedQuestion[];
}

export interface RegistryMeta {
  k_anon_floor: number;
  /** True when this deployment publishes below LAW 3's production floor of 50. */
  relaxed_floor: boolean;
  production_floor: number;
  generated_at: string;
}

// Genuinely public, by design — not the "unauthenticated for now" posture
// §19E gives every /v1/admin/* endpoint. Every row here already cleared
// LAW 3's k-anonymity floor before it could exist at all (the
// enforce_k_anon_floor() trigger on both aggregate tables), so there's
// nothing here for auth to protect.
@Injectable()
export class PublicService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly kAnon: KAnonService
  ) {}

  async getRegistry() {
    const [registry, opportunities, groups] = await Promise.all([
      this.loadRegistryRows(),
      this.loadOpportunityRows(),
      this.loadDemandGroups(),
    ]);

    return {
      registry,
      opportunities,
      // The two buckets (SPEC.md §43). Split on categories.kind, which is a
      // declared property of the category, not inferred from whether products
      // happen to be linked to it — see the migration for why inference
      // isn't available here.
      products: groups.filter((g) => g.kind === "product").map(stripKind),
      topics: groups.filter((g) => g.kind === "topic").map(stripKind),
      meta: {
        k_anon_floor: this.kAnon.getFloor(),
        relaxed_floor: this.kAnon.isRelaxed(),
        production_floor: K_ANON_FLOOR,
        generated_at: new Date().toISOString(),
      } satisfies RegistryMeta,
    };
  }

  private async loadRegistryRows(): Promise<RegistryRow[]> {
    const { rows } = await this.pool.query<RegistryRow>(
      `SELECT da.id, c.name AS category_name, z.name AS zone_name, z.level AS zone_level,
              da.cohort_size, da.computed_at
       FROM demand_aggregates da
       JOIN categories c ON c.id = da.category_id
       JOIN zones z ON z.id = da.zone_id
       WHERE c.published = true
       ORDER BY da.computed_at DESC
       LIMIT 200`
    );
    return rows;
  }

  // "Opportunities" (SPEC.md §29) — real, published demand with no open
  // offer serving it yet. Never leaks a supplier's negotiated pricing
  // (offers.collective_price_paise/market_price_paise) — only whether one
  // exists at all, same aggregate-only posture as the registry itself.
  private async loadOpportunityRows(): Promise<RegistryRow[]> {
    const { rows } = await this.pool.query<RegistryRow>(
      `SELECT da.id, c.name AS category_name, z.name AS zone_name, z.level AS zone_level,
              da.cohort_size, da.computed_at
       FROM demand_aggregates da
       JOIN categories c ON c.id = da.category_id
       JOIN zones z ON z.id = da.zone_id
       WHERE c.published = true
         AND NOT EXISTS (
           SELECT 1 FROM offers o
           JOIN products p ON p.product_code = o.product_code
           WHERE p.category_id = da.category_id AND o.zone_id = da.zone_id AND o.status = 'open'
         )
       ORDER BY da.cohort_size DESC
       LIMIT 100`
    );
    return rows;
  }

  /**
   * Every published per-question stat, grouped into category × zone cards.
   *
   * Selects `q.text_en` and the aggregate's own columns only — never
   * `responses`, never `alias_id`, and never the free-text/photo evidence
   * hanging off a response. There is no query in this file that could return
   * an individual answer even if it were asked to.
   */
  private async loadDemandGroups(): Promise<Array<DemandGroup & { kind: string }>> {
    const { rows } = await this.pool.query<{
      category_id: number;
      category_slug: string;
      category_name: string;
      kind: string;
      zone_id: string;
      zone_name: string;
      zone_level: string;
      question_id: number;
      text: string;
      type: string;
      cohort_size: number;
      distribution: unknown;
      computed_at: string;
      has_open_offer: boolean;
    }>(
      `SELECT c.id AS category_id, c.slug AS category_slug, c.name AS category_name, c.kind,
              z.id AS zone_id, z.name AS zone_name, z.level AS zone_level,
              q.id AS question_id, q.text_en AS text, q.type,
              qsa.cohort_size, qsa.distribution, qsa.computed_at,
              EXISTS (
                SELECT 1 FROM offers o
                JOIN products p ON p.product_code = o.product_code
                WHERE p.category_id = c.id AND o.zone_id = qsa.zone_id AND o.status = 'open'
              ) AS has_open_offer
       FROM question_stat_aggregates qsa
       JOIN questions q ON q.id = qsa.question_id
       JOIN categories c ON c.id = q.category_id
       JOIN zones z ON z.id = qsa.zone_id
       WHERE c.published = true
       ORDER BY c.name, z.name, q.id`
    );

    const groups = new Map<string, DemandGroup & { kind: string }>();
    for (const r of rows) {
      const key = `${r.category_id}:${r.zone_id}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          category_id: r.category_id,
          category_slug: r.category_slug,
          category_name: r.category_name,
          kind: r.kind,
          zone_id: r.zone_id,
          zone_name: r.zone_name,
          zone_level: r.zone_level,
          households: 0,
          intending: null,
          has_open_offer: r.has_open_offer,
          questions: [],
        };
        groups.set(key, group);
      }
      group.households = Math.max(group.households, r.cohort_size);
      if (r.type === "intent_window") {
        group.intending = Math.max(group.intending ?? 0, intendingCount(r.distribution));
      }
      group.questions.push({
        question_id: r.question_id,
        text: r.text,
        type: r.type,
        cohort_size: r.cohort_size,
        distribution: r.distribution,
        computed_at: r.computed_at,
      });
    }

    // Biggest cohort first — a supplier scanning this page should meet the
    // largest addressable demand before the smallest.
    return [...groups.values()].sort((a, b) => b.households - a.households);
  }
}

/** "Yes" + "Maybe" on an intent_window question — the declared-demand headline. */
function intendingCount(distribution: unknown): number {
  const dist = distribution as { kind?: string; options?: Array<{ label: string; count: number }> };
  if (dist?.kind !== "options" || !Array.isArray(dist.options)) return 0;
  return dist.options
    .filter((o) => /^(yes|maybe)$/i.test(o.label.trim()))
    .reduce((sum, o) => sum + o.count, 0);
}

function stripKind(group: DemandGroup & { kind: string }): DemandGroup {
  const { kind: _kind, ...rest } = group;
  return rest;
}
