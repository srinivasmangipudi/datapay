import { getPortalPool } from "./db";

export interface TokenRatePoint {
  ratePaise: number;
  computedAt: string;
  inputs: { demandPressure: number; realisedSalesVelocity: number; supplierCompetition: number };
}

export interface AggregateRow {
  id: number;
  categoryName: string;
  zoneName: string;
  zoneLevel: string;
  cohortSize: number;
  computedAt: string;
}

export async function getTokenRateHistory(limit = 50): Promise<TokenRatePoint[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<{
    rate_paise: string;
    computed_at: string;
    inputs: TokenRatePoint["inputs"];
  }>(
    `SELECT rate_paise, computed_at, inputs FROM token_rate ORDER BY computed_at ASC LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    ratePaise: Number(r.rate_paise),
    computedAt: r.computed_at,
    inputs: r.inputs,
  }));
}

export async function getDemandAggregates(limit = 100): Promise<AggregateRow[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<{
    id: number;
    category_name: string;
    zone_name: string;
    zone_level: string;
    cohort_size: number;
    computed_at: string;
  }>(
    `SELECT da.id, c.name AS category_name, z.name AS zone_name, z.level AS zone_level,
            da.cohort_size, da.computed_at
     FROM demand_aggregates da
     JOIN categories c ON c.id = da.category_id
     JOIN zones z ON z.id = da.zone_id
     ORDER BY da.computed_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    categoryName: r.category_name,
    zoneName: r.zone_name,
    zoneLevel: r.zone_level,
    cohortSize: r.cohort_size,
    computedAt: r.computed_at,
  }));
}
