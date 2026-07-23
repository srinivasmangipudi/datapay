import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
import { LedgerService } from "../ledger/ledger.service";

interface OfferRow {
  id: number;
  product_code: string;
  display_name: string;
  display_name_kn: string | null;
  zone_id: string;
  zone_name: string;
  collective_price_paise: number;
  market_price_paise: number;
  min_participants: number;
  max_participants: number | null;
  closes_at: Date;
  status: string;
  max_tokens_redeemable: number | null;
  token_value_paise: number | null;
  joined_count: string;
}

@Injectable()
export class OffersService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly ledger: LedgerService
  ) {}

  async list(zoneId?: string) {
    const { rows } = await this.pool.query<OfferRow>(
      `SELECT o.id, o.product_code, p.display_name, p.display_name_kn, o.zone_id, z.name AS zone_name,
              o.collective_price_paise, o.market_price_paise, o.min_participants, o.max_participants,
              o.closes_at, o.status, ott.max_tokens_redeemable, ott.token_value_paise,
              (SELECT COUNT(*) FROM offer_participation op
                 WHERE op.offer_id = o.id AND op.state != 'cancelled') AS joined_count
       FROM offers o
       JOIN products p ON p.product_code = o.product_code
       JOIN zones z ON z.id = o.zone_id
       LEFT JOIN offer_token_terms ott ON ott.offer_id = o.id
       WHERE o.status = 'open' AND ($1::uuid IS NULL OR o.zone_id = $1)
       ORDER BY o.closes_at ASC`,
      [zoneId ?? null]
    );
    return rows.map((r) => ({
      id: r.id,
      productCode: r.product_code,
      displayName: r.display_name,
      displayNameKn: r.display_name_kn,
      zoneId: r.zone_id,
      zoneName: r.zone_name,
      collectivePricePaise: r.collective_price_paise,
      marketPricePaise: r.market_price_paise,
      minParticipants: r.min_participants,
      maxParticipants: r.max_participants,
      closesAt: r.closes_at,
      status: r.status,
      maxTokensRedeemable: r.max_tokens_redeemable,
      tokenValuePaise: r.token_value_paise,
      joinedCount: Number(r.joined_count),
    }));
  }

  /**
   * The redemption gate (SPEC.md §6, LAW 2) plus §15D's lock-and-check
   * discipline: the member's balance row is locked FOR UPDATE for the whole
   * transaction, so two concurrent join/redeem calls for the same alias
   * serialize — the second re-reads the post-first-commit balance, never a
   * stale one. Tokens only ever redeem against a matching, unfulfilled,
   * unexpired declared intent — never "tokens you happen to have."
   */
  async join(aliasId: string, offerId: number, qty: number, tokensToRedeem: number) {
    const result = await withTransaction(this.pool, async (client) => {
      const { rows: memberRows } = await client.query<{ token_balance: number }>(
        `SELECT token_balance FROM members WHERE alias_id = $1 FOR UPDATE`,
        [aliasId]
      );
      if (!memberRows[0]) throw new NotFoundException("Member not found");

      const { rows: offerRows } = await client.query<{
        id: number;
        status: string;
        category_id: number;
        max_tokens_redeemable: number | null;
      }>(
        `SELECT o.id, o.status, p.category_id, ott.max_tokens_redeemable
         FROM offers o
         JOIN products p ON p.product_code = o.product_code
         LEFT JOIN offer_token_terms ott ON ott.offer_id = o.id
         WHERE o.id = $1 FOR UPDATE OF o`,
        [offerId]
      );
      const offer = offerRows[0];
      if (!offer) throw new NotFoundException("Offer not found");
      if (offer.status !== "open") throw new BadRequestException("Offer is not open");

      const { rows: existing } = await client.query(
        `SELECT id FROM offer_participation WHERE offer_id = $1 AND alias_id = $2`,
        [offerId, aliasId]
      );
      if (existing[0]) throw new BadRequestException("Already joined this offer");

      let matchedIntentId: number | null = null;
      if (tokensToRedeem > 0) {
        if (tokensToRedeem > memberRows[0].token_balance) {
          throw new BadRequestException("Insufficient token balance");
        }
        if (offer.max_tokens_redeemable != null && tokensToRedeem > offer.max_tokens_redeemable) {
          throw new BadRequestException(
            `Cannot redeem more than ${offer.max_tokens_redeemable} tokens on this offer`
          );
        }

        const { rows: intentRows } = await client.query<{ id: number }>(
          `SELECT id FROM intents
           WHERE alias_id = $1 AND product_category_id = $2
             AND fulfilled_offer_id IS NULL AND expires_at > now()
           ORDER BY declared_at DESC LIMIT 1 FOR UPDATE`,
          [aliasId, offer.category_id]
        );
        if (!intentRows[0]) {
          throw new BadRequestException(
            "No matching declared intent — tokens cannot redeem against demand you never declared (LAW 2)"
          );
        }
        matchedIntentId = intentRows[0].id;
      }

      const relayToken = randomUUID();
      const { rows: participationRows } = await client.query<{ id: number }>(
        `INSERT INTO offer_participation (offer_id, alias_id, qty, tokens_redeemed, relay_token)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [offerId, aliasId, qty, tokensToRedeem, relayToken]
      );
      const participationId = participationRows[0].id;

      if (tokensToRedeem > 0 && matchedIntentId) {
        await this.ledger.creditTokens({
          client,
          aliasId,
          entry: "redeem_offer",
          tokens: -tokensToRedeem,
          refType: "offer_participation",
          refId: participationId,
        });
        await client.query(`UPDATE intents SET fulfilled_offer_id = $1 WHERE id = $2`, [
          offerId,
          matchedIntentId,
        ]);
      }

      return { participationId, relayToken, offerId, tokensRedeemed: tokensToRedeem };
    });

    // Identity-blind fulfillment (§7): register the relay mapping in Vault
    // AFTER the join/redemption commits — never before, so a failed join
    // never leaves a dangling relay token pointing at nothing.
    await this.registerRelay(aliasId, result.relayToken, `offer:${offerId}`);

    return result;
  }

  private async registerRelay(aliasId: string, relayToken: string, offerRef: string) {
    const vaultUrl = process.env.VAULT_INTERNAL_URL;
    if (!vaultUrl) throw new Error("Missing VAULT_INTERNAL_URL");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days, §7

    const res = await fetch(`${vaultUrl}/relay-map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliasId, relayToken, offerRef, expiresAt }),
    });
    if (!res.ok) {
      const data: { message?: string } = await res.json().catch(() => ({}));
      throw new BadRequestException(
        data.message ?? "Could not register pickup — set a delivery address first"
      );
    }
  }

  async leave(aliasId: string, offerId: number) {
    const { rows } = await this.pool.query<{ id: number; tokens_redeemed: number }>(
      `SELECT id, tokens_redeemed FROM offer_participation WHERE offer_id = $1 AND alias_id = $2`,
      [offerId, aliasId]
    );
    if (!rows[0]) throw new NotFoundException("Not joined");
    if (rows[0].tokens_redeemed > 0) {
      throw new BadRequestException("Cannot leave — tokens already redeemed against this offer");
    }
    await this.pool.query(`UPDATE offer_participation SET state = 'cancelled' WHERE id = $1`, [
      rows[0].id,
    ]);
    return { ok: true };
  }
}
