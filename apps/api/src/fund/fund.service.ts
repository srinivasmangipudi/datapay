import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
import { CorpusFundService } from "../corpus-fund/corpus-fund.service";
import { LedgerService } from "../ledger/ledger.service";

// The community's cut of the collective-buy savings on a delivered offer.
// This is the pre-existing §17 mechanism (20% of savings, spent on
// member-voted local projects) — deliberately left as-is. Whether it merges
// with the new corpus fund below is an open question
// (TOKEN_ECONOMY_REDESIGN.md), not decided here; the two coexist for now.
const FUND_ACCRUAL_RATE = 0.2;

// TOKEN_ECONOMY_REDESIGN.md — the new revenue mechanism. On every confirmed
// purchase: the supplier's cut funds the corpus (never spent, only its
// future investment returns are meant to be distributed as dividends — not
// built yet); the buyer's cut comes back to them as ordinary tokens, the
// same kind earned by answering questions. Both computed off the same
// number — what the buyer actually paid (qty × collective_price_paise) —
// which is the honest, real "amount spent" already tracked in this system,
// independent of how payment is actually collected.
const CORPUS_FUND_RATE = 0.02;
const PURCHASE_TOKEN_REWARD_RATE = 0.02;

@Injectable()
export class FundService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly corpusFund: CorpusFundService,
    private readonly ledger: LedgerService
  ) {}

  /**
   * SPEC.md §12 Phase 5: "fund accrues from completed offers." Confirming
   * delivery is the completion event. Idempotent both on the state
   * transition (already-delivered is a clean no-op) and on every ledger
   * write (UNIQUE(ref_type, ref_id) — same discipline as §15's
   * token_ledger, applied here to real rupees too).
   *
   * TOKEN_ECONOMY_REDESIGN.md — the SAME event now also: credits the buyer
   * new tokens worth 2% of what they spent (a second, ordinary way to earn
   * tokens — not "unlocking" or "actualising" the ones redeemed to join;
   * that causal-attribution idea was tried and rejected as unprovable), and
   * credits 2% of the sale into the corpus fund. Replaces SPEC.md §40's
   * reserve entirely.
   */
  async confirmDelivery(aliasId: string, offerId: number) {
    return withTransaction(this.pool, async (client) => {
      const { rows: partRows } = await client.query<{
        id: number;
        state: string;
        qty: number;
        tokens_redeemed: number;
      }>(
        `SELECT id, state, qty, tokens_redeemed FROM offer_participation
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

      const amountSpentPaise = offer.collective_price_paise * partRows[0].qty;
      const corpusContributionPaise = Math.round(amountSpentPaise * CORPUS_FUND_RATE);
      if (corpusContributionPaise > 0) {
        await this.corpusFund.creditContribution({
          client,
          amountPaise: corpusContributionPaise,
          refType: "offer_participation",
          refId: partRows[0].id,
        });
      }

      // 2% of spend, expressed as a whole-rupee token count (paise / 100) —
      // an ordinary earn, same ledger as answering a question.
      const purchaseTokens = Math.round((amountSpentPaise * PURCHASE_TOKEN_REWARD_RATE) / 100);
      if (purchaseTokens > 0) {
        await this.ledger.creditTokens({
          client,
          aliasId,
          entry: "earn_purchase",
          tokens: purchaseTokens,
          refType: "offer_delivery",
          refId: partRows[0].id,
        });
      }

      return {
        status: "confirmed" as const,
        accruedPaise: accrualPaise,
        corpusContributionPaise,
        purchaseTokens,
      };
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

  /**
   * Member-facing list: scoped to the caller's own zone, and — unlike
   * listAllProjects() — includes `myVote` so the mobile client can render the
   * caller's own upvote/downvote state without depending on ephemeral local
   * state that's lost on relaunch (SPEC.md §30).
   */
  async listProjects(zoneId: string, aliasId: string) {
    const { rows } = await this.pool.query<{
      id: number;
      title: string;
      title_kn: string | null;
      estimate_paise: number;
      status: string;
      yes_votes: string;
      no_votes: string;
      my_vote: "yes" | "no" | null;
    }>(
      `SELECT p.id, p.title, p.title_kn, p.estimate_paise, p.status,
              COUNT(*) FILTER (WHERE v.vote = 'yes') AS yes_votes,
              COUNT(*) FILTER (WHERE v.vote = 'no') AS no_votes,
              (SELECT vote FROM fund_votes WHERE project_id = p.id AND alias_id = $2) AS my_vote
       FROM fund_projects p
       LEFT JOIN fund_votes v ON v.project_id = p.id
       WHERE p.zone_id = $1
       GROUP BY p.id
       ORDER BY p.id DESC`,
      [zoneId, aliasId]
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      titleKn: r.title_kn,
      estimatePaise: r.estimate_paise,
      status: r.status,
      yesVotes: Number(r.yes_votes),
      noVotes: Number(r.no_votes),
      myVote: r.my_vote,
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

  /**
   * Ops edit (SPEC.md §31) — partial update, so the admin table can save just
   * a status change without re-sending the whole project. `RETURNING id` is
   * also how a bad `:id` gets turned into a 404 instead of a silent no-op.
   */
  async updateProject(
    id: number,
    patch: { title?: string; titleKn?: string; estimatePaise?: number; status?: string }
  ) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (patch.title !== undefined) {
      sets.push(`title = $${i++}`);
      values.push(patch.title);
    }
    if (patch.titleKn !== undefined) {
      sets.push(`title_kn = $${i++}`);
      values.push(patch.titleKn);
    }
    if (patch.estimatePaise !== undefined) {
      sets.push(`estimate_paise = $${i++}`);
      values.push(patch.estimatePaise);
    }
    if (patch.status !== undefined) {
      sets.push(`status = $${i++}`);
      values.push(patch.status);
    }
    values.push(id);
    const { rows } = await this.pool.query<{ id: number }>(
      `UPDATE fund_projects SET ${sets.join(", ")} WHERE id = $${i} RETURNING id`,
      values
    );
    if (!rows[0]) throw new NotFoundException("Project not found");
    return { id: rows[0].id };
  }

  /**
   * Member-facing proposal (SPEC.md §30) — same insert as createProject(),
   * just with the zone resolved from the caller's own membership rather than
   * accepted as input, so a member can only ever propose into their own zone.
   */
  async proposeProject(
    aliasId: string,
    title: string,
    titleKn: string | undefined,
    estimatePaise: number
  ) {
    const zoneId = await this.getMemberZone(aliasId);
    return this.createProject(zoneId, title, titleKn, estimatePaise);
  }
}
