import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";

// The community's cut of the collective-buy savings on a delivered offer.
// The 50/20/30 split (tokens/fund/operations) is a business & legal decision
// documented in the pitch deck, not something this code invents as fact —
// tunable here, deliberately not silently hardcoded three places.
const FUND_ACCRUAL_RATE = 0.2;

@Injectable()
export class FundService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * SPEC.md §12 Phase 5: "fund accrues from completed offers." Confirming
   * delivery is the completion event. Idempotent both on the state
   * transition (already-delivered is a clean no-op) and on the ledger write
   * (UNIQUE(ref_type, ref_id) — same discipline as §15's token_ledger,
   * applied here to real rupees instead of closed-loop tokens).
   */
  async confirmDelivery(aliasId: string, offerId: number) {
    return withTransaction(this.pool, async (client) => {
      const { rows: partRows } = await client.query<{
        id: number;
        state: string;
        qty: number;
      }>(
        `SELECT id, state, qty FROM offer_participation
         WHERE offer_id = $1 AND alias_id = $2 FOR UPDATE`,
        [offerId, aliasId]
      );
      if (!partRows[0]) throw new NotFoundException("Not joined to this offer");
      if (partRows[0].state === "delivered") {
        return { status: "already_confirmed" as const };
      }
      if (partRows[0].state === "cancelled") {
        throw new BadRequestException("Cannot confirm a cancelled participation");
      }

      const { rows: offerRows } = await client.query<{
        zone_id: string;
        collective_price_paise: number;
        market_price_paise: number;
      }>(
        `SELECT zone_id, collective_price_paise, market_price_paise FROM offers WHERE id = $1`,
        [offerId]
      );
      const offer = offerRows[0];

      await client.query(`UPDATE offer_participation SET state = 'delivered' WHERE id = $1`, [
        partRows[0].id,
      ]);

      const savingsPerUnit = offer.market_price_paise - offer.collective_price_paise;
      const accrualPaise = Math.max(
        0,
        Math.round(savingsPerUnit * partRows[0].qty * FUND_ACCRUAL_RATE)
      );

      if (accrualPaise > 0) {
        try {
          await client.query(
            `INSERT INTO fund_ledger (zone_id, entry, amount_paise, ref_type, ref_id)
             VALUES ($1, 'accrual', $2, 'offer_participation', $3)`,
            [offer.zone_id, accrualPaise, partRows[0].id]
          );
        } catch (err) {
          if ((err as { code?: string }).code !== "23505") throw err; // idempotent replay
        }
      }

      return { status: "confirmed" as const, accruedPaise: accrualPaise };
    });
  }

  async getMemberZone(aliasId: string): Promise<string> {
    const { rows } = await this.pool.query<{ zone_id: string }>(
      `SELECT zone_id FROM members WHERE alias_id = $1`,
      [aliasId]
    );
    if (!rows[0]) throw new NotFoundException("Member not found");
    return rows[0].zone_id;
  }

  async getBalance(zoneId: string) {
    const { rows } = await this.pool.query<{ balance: string }>(
      `SELECT COALESCE(SUM(CASE WHEN entry = 'accrual' THEN amount_paise ELSE -amount_paise END), 0) AS balance
       FROM fund_ledger WHERE zone_id = $1`,
      [zoneId]
    );
    return { zoneId, balancePaise: Number(rows[0].balance) };
  }

  async listProjects(zoneId: string) {
    const { rows } = await this.pool.query<{
      id: number;
      title: string;
      title_kn: string | null;
      estimate_paise: number;
      status: string;
    }>(
      `SELECT id, title, title_kn, estimate_paise, status FROM fund_projects
       WHERE zone_id = $1 ORDER BY id DESC`,
      [zoneId]
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      titleKn: r.title_kn,
      estimatePaise: r.estimate_paise,
      status: r.status,
    }));
  }

  async vote(aliasId: string, projectId: number, vote: "yes" | "no") {
    try {
      await this.pool.query(
        `INSERT INTO fund_votes (project_id, alias_id, vote) VALUES ($1, $2, $3)`,
        [projectId, aliasId, vote]
      );
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        throw new BadRequestException("Already voted on this project — one member, one vote");
      }
      throw err;
    }
    return { ok: true };
  }

  /**
   * Ops-wide view across every zone at once, vote tallies included — unlike
   * the member-facing listProjects(zoneId), which is scoped to the caller's
   * own zone via AliasAuthGuard.
   */
  async listAllProjects() {
    const { rows } = await this.pool.query(
      `SELECT p.id, p.title, p.title_kn, p.estimate_paise, p.status, p.created_at,
              p.zone_id, z.name AS zone_name,
              COUNT(*) FILTER (WHERE v.vote = 'yes') AS yes_votes,
              COUNT(*) FILTER (WHERE v.vote = 'no') AS no_votes
       FROM fund_projects p
       JOIN zones z ON z.id = p.zone_id
       LEFT JOIN fund_votes v ON v.project_id = p.id
       GROUP BY p.id, z.name
       ORDER BY p.id DESC`
    );
    return rows;
  }

  async createProject(zoneId: string, title: string, titleKn: string | undefined, estimatePaise: number) {
    const { rows } = await this.pool.query<{ id: number }>(
      `INSERT INTO fund_projects (zone_id, title, title_kn, estimate_paise) VALUES ($1, $2, $3, $4) RETURNING id`,
      [zoneId, title, titleKn ?? null, estimatePaise]
    );
    return { id: rows[0].id };
  }
}
