import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { AuditService } from "../audit/audit.service";
import { PG_POOL } from "../db/db.module";

// §6B's "internal-first" priority, applied to the sell side too (SPEC.md §12
// Phase 6): local supply meeting the local demand ledger always surfaces
// before an external buyer. Insertion order == this rank, so linkage.id
// ordering IS the rank — no separate "priority" column to drift out of sync.
const BUYER_KIND_RANK = ["internal_collective", "local_processor", "institutional", "external_trader", "retail_chain"];

const VALID_TRANSITIONS: Record<string, string[]> = {
  suggested: ["producer_interested", "declined"],
  producer_interested: ["negotiating", "declined"],
  negotiating: ["agreed", "declined"],
  agreed: ["completed"],
};

@Injectable()
export class LinkagesService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService
  ) {}

  /**
   * SPEC.md §6B / Phase 6: pairs a listing with candidate buyers,
   * internal-collective first. Not a guess dressed as fact — the ORDER BY
   * mirrors BUYER_KIND_RANK exactly, and linkages are inserted in that same
   * order, so the acceptance test ("internal-collective ranks first") is
   * just "read the first row back."
   */
  async matchListing(listingId: number) {
    const { rows: listingRows } = await this.pool.query<{
      produce_category_id: number;
      asking_price_paise: number | null;
    }>(`SELECT produce_category_id, asking_price_paise FROM produce_listings WHERE id = $1`, [
      listingId,
    ]);
    if (!listingRows[0]) throw new NotFoundException("Listing not found");
    const { produce_category_id: categoryId, asking_price_paise: askingPrice } = listingRows[0];

    const { rows: buyers } = await this.pool.query<{ id: number; kind: string }>(
      `SELECT id, kind FROM buyer_directory WHERE $1 = ANY(produce_category_ids)
       ORDER BY array_position($2::text[], kind), id ASC`,
      [categoryId, BUYER_KIND_RANK]
    );

    let created = 0;
    for (const buyer of buyers) {
      await this.pool.query(
        `INSERT INTO linkages (listing_id, buyer_id, proposed_price_paise, state)
         VALUES ($1, $2, $3, 'suggested')`,
        [listingId, buyer.id, askingPrice ?? 0]
      );
      created += 1;
    }

    await this.pool.query(`UPDATE produce_listings SET state = 'matched' WHERE id = $1`, [
      listingId,
    ]);
    await this.audit.record(
      "system",
      null,
      "run_produce_matching",
      `listing:${listingId} linkages:${created}`
    );

    return { listingId, linkagesCreated: created };
  }

  async listForListing(aliasId: string, listingId: number) {
    const { rows: listing } = await this.pool.query<{ alias_id: string }>(
      `SELECT alias_id FROM produce_listings WHERE id = $1`,
      [listingId]
    );
    if (!listing[0]) throw new NotFoundException("Listing not found");
    if (listing[0].alias_id !== aliasId) throw new ForbiddenException("Not your listing");

    const { rows } = await this.pool.query<{
      id: number;
      buyer_kind: string;
      contact_ref: string;
      proposed_price_paise: number;
      distance_km: string | null;
      state: string;
      identity_disclosed_at: Date | null;
    }>(
      `SELECT l.id, b.kind AS buyer_kind, b.contact_ref, l.proposed_price_paise, l.distance_km,
              l.state, l.identity_disclosed_at
       FROM linkages l JOIN buyer_directory b ON b.id = l.buyer_id
       WHERE l.listing_id = $1 ORDER BY l.id ASC`,
      [listingId]
    );
    return rows.map((r) => ({
      id: r.id,
      buyerKind: r.buyer_kind,
      contactRef: r.contact_ref,
      proposedPricePaise: r.proposed_price_paise,
      distanceKm: r.distance_km ? Number(r.distance_km) : null,
      state: r.state,
      identityDisclosed: r.identity_disclosed_at !== null,
    }));
  }

  /**
   * Progressive identity disclosure (§8 screen 5): identity_disclosed_at is
   * NULL through suggested/producer_interested/negotiating. Only the
   * explicit "Reveal & proceed" transition to 'agreed' ever sets it — and
   * it's a one-way door, never cleared back to NULL by any later state change.
   */
  async advance(aliasId: string, linkageId: number, toState: string) {
    const { rows } = await this.pool.query<{ id: number; state: string; alias_id: string }>(
      `SELECT l.id, l.state, pl.alias_id
       FROM linkages l JOIN produce_listings pl ON pl.id = l.listing_id
       WHERE l.id = $1`,
      [linkageId]
    );
    if (!rows[0]) throw new NotFoundException("Linkage not found");
    if (rows[0].alias_id !== aliasId) throw new ForbiddenException("Not your listing");

    const allowed = VALID_TRANSITIONS[rows[0].state];
    if (!allowed?.includes(toState)) {
      throw new BadRequestException(`Cannot move from '${rows[0].state}' to '${toState}'`);
    }

    if (toState === "agreed") {
      await this.pool.query(
        `UPDATE linkages SET state = $1, identity_disclosed_at = now() WHERE id = $2`,
        [toState, linkageId]
      );
    } else {
      await this.pool.query(`UPDATE linkages SET state = $1 WHERE id = $2`, [toState, linkageId]);
    }

    const { rows: after } = await this.pool.query<{ identity_disclosed_at: Date | null }>(
      `SELECT identity_disclosed_at FROM linkages WHERE id = $1`,
      [linkageId]
    );

    return {
      id: linkageId,
      state: toState,
      identityDisclosed: after[0].identity_disclosed_at !== null,
    };
  }
}
