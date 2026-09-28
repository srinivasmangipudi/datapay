import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { purchaseTokenReward } from "@datapay/shared";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
import { LedgerService } from "../ledger/ledger.service";

/** Internal signal, never surfaced: a concurrent request won the
    client_msg_id race, so this transaction must roll back its stock decrement
    and the caller should return the winner's order instead of an error. */
class ConcurrentOrderReplay extends Error {}

interface BrowseProductRow {
  id: number;
  name_en: string;
  name_kn: string | null;
  description_en: string | null;
  unit_spec: string | null;
  market_price_paise: number;
  sale_price_paise: number;
  quantity_available: number;
  photo_url: string | null;
  organization_name: string;
}

// Member-facing browse + reserve — mirrors PulseService's zone ancestor-chain
// pattern for region scoping, and OffersService's join() locking pattern for
// the actual reservation (SPEC.md §7-style identity-blind fulfillment: the
// org never sees the member directly, only a relay_token).
@Injectable()
export class ProductsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly ledger: LedgerService
  ) {}

  async browse(aliasId: string) {
    const { rows } = await this.pool.query<BrowseProductRow>(
      `WITH RECURSIVE member_zone_chain AS (
         SELECT z.id, z.parent_id FROM zones z
         JOIN members m ON m.zone_id = z.id
         WHERE m.alias_id = $1
         UNION ALL
         SELECT z.id, z.parent_id FROM zones z
         JOIN member_zone_chain c ON z.id = c.parent_id
       )
       SELECT p.id, p.name_en, p.name_kn, p.description_en, p.unit_spec,
              p.market_price_paise, p.sale_price_paise, p.quantity_available,
              p.photo_url, o.name AS organization_name
       FROM org_products p
       JOIN organizations o ON o.id = p.organization_id
       WHERE p.review_state = 'approved'
         AND p.quantity_available > 0
         AND (p.zone_id IS NULL OR p.zone_id IN (SELECT id FROM member_zone_chain))
       ORDER BY p.id DESC`,
      [aliasId]
    );
    return rows.map((r) => ({
      id: r.id,
      nameEn: r.name_en,
      nameKn: r.name_kn,
      descriptionEn: r.description_en,
      unitSpec: r.unit_spec,
      marketPricePaise: r.market_price_paise,
      salePricePaise: r.sale_price_paise,
      quantityAvailable: r.quantity_available,
      photoUrl: r.photo_url,
      organizationName: r.organization_name,
    }));
  }

  /**
   * Reserve-only: locks the product row, checks stock, decrements it, and
   * records the order — all in one transaction so two concurrent orders for
   * the last unit can't both succeed. Registers a relay mapping with Vault
   * BEFORE any stock is touched — unlike a plain offer join (no stock
   * counter of its own), a product order consumes a genuinely scarce
   * resource, so a failed relay registration (e.g. no delivery address on
   * file) must never leave a phantom decrement with no order to show for
   * it. The relay_token is generated up front and carries no dependency on
   * the order row that's created after — `offer_ref` is a purely
   * descriptive label to Vault, never used to resolve anything.
   *
   * Idempotent on clientMsgId (§15C). The replay check runs BEFORE
   * registerRelay, not just as an ON CONFLICT inside the transaction: a retry
   * that got as far as Vault would otherwise leave an orphaned relay_map row
   * pointing at a real delivery address for an order that was never created
   * twice. The ON CONFLICT below still matters — it's what makes two genuinely
   * concurrent requests carrying the same key safe, where both pass the check.
   */
  async order(aliasId: string, productId: number, quantity: number, clientMsgId: string) {
    const existing = await this.findOrderByClientMsgId(aliasId, clientMsgId);
    if (existing) return existing;

    const relayToken = randomUUID();
    await this.registerRelay(aliasId, relayToken, `product-order:${relayToken}`);

    return withTransaction(this.pool, async (client) => {
      const { rows: productRows } = await client.query<{
        id: number;
        review_state: string;
        quantity_available: number;
        sale_price_paise: number;
        token_reward_bps: number | null;
      }>(
        `SELECT id, review_state, quantity_available, sale_price_paise, token_reward_bps
         FROM org_products WHERE id = $1 FOR UPDATE`,
        [productId]
      );
      const product = productRows[0];
      if (!product) throw new NotFoundException("Product not found");
      if (product.review_state !== "approved") {
        throw new BadRequestException("Product is not available");
      }
      if (product.quantity_available < quantity) {
        throw new BadRequestException("Not enough quantity available");
      }

      await client.query(
        `UPDATE org_products SET quantity_available = quantity_available - $1, updated_at = now() WHERE id = $2`,
        [quantity, productId]
      );

      const { rows: orderRows } = await client.query<{ id: number }>(
        `INSERT INTO product_orders (org_product_id, alias_id, relay_token, quantity, unit_price_paise, client_msg_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (client_msg_id) DO NOTHING
         RETURNING id`,
        [productId, aliasId, relayToken, quantity, product.sale_price_paise, clientMsgId]
      );

      // Lost a race with a concurrent request carrying the same key. The
      // decrement above is rolled back with this transaction, so the winner's
      // order stands alone and stock was only ever taken once.
      if (!orderRows[0]) {
        throw new ConcurrentOrderReplay();
      }

      // The buyer's token reward, at this product's rate or the platform
      // default. Credited here at order time rather than on delivery, because
      // an org product order has no delivery-confirmation step the way a
      // collective offer does — there is no later event to hang it off.
      // Idempotent via the ledger's UNIQUE(ref_type, ref_id), so the replay
      // paths above can never credit twice.
      const tokens = purchaseTokenReward(
        product.sale_price_paise * quantity,
        product.token_reward_bps
      );
      if (tokens > 0) {
        await this.ledger.creditTokens({
          client,
          aliasId,
          entry: "earn_purchase",
          tokens,
          refType: "product_order",
          refId: orderRows[0].id,
        });
      }

      return { orderId: orderRows[0].id, relayToken, tokensEarned: tokens };
    }).catch(async (err) => {
      if (err instanceof ConcurrentOrderReplay) {
        const winner = await this.findOrderByClientMsgId(aliasId, clientMsgId);
        if (winner) return winner;
      }
      throw err;
    });
  }

  /** Reports tokensEarned from the ledger rather than recomputing it, so a
      retry echoes what was actually credited even if the product's rate
      changed between the first attempt and the replay. */
  private async findOrderByClientMsgId(
    aliasId: string,
    clientMsgId: string
  ): Promise<{ orderId: number; relayToken: string; tokensEarned: number } | null> {
    const { rows } = await this.pool.query<{
      id: number;
      relay_token: string;
      tokens: number | null;
    }>(
      `SELECT po.id, po.relay_token,
              (SELECT tl.tokens FROM token_ledger tl
                WHERE tl.ref_type = 'product_order' AND tl.ref_id = po.id::text) AS tokens
       FROM product_orders po
       WHERE po.client_msg_id = $1 AND po.alias_id = $2`,
      [clientMsgId, aliasId]
    );
    return rows[0]
      ? { orderId: rows[0].id, relayToken: rows[0].relay_token, tokensEarned: rows[0].tokens ?? 0 }
      : null;
  }

  private async registerRelay(aliasId: string, relayToken: string, offerRef: string) {
    const vaultUrl = process.env.VAULT_INTERNAL_URL;
    if (!vaultUrl) throw new Error("Missing VAULT_INTERNAL_URL");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days, same as offers/§7

    const res = await fetch(`${vaultUrl}/relay-map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliasId, relayToken, offerRef, expiresAt }),
    });
    if (!res.ok) {
      const data: { message?: string } = await res.json().catch(() => ({}));
      throw new BadRequestException(
        data.message ?? "Could not place order — set a delivery address first"
      );
    }
  }

  async listMyOrders(aliasId: string) {
    const { rows } = await this.pool.query(
      `SELECT po.id, po.quantity, po.unit_price_paise, po.status, po.created_at,
              op.name_en, op.photo_url
       FROM product_orders po
       JOIN org_products op ON op.id = po.org_product_id
       WHERE po.alias_id = $1
       ORDER BY po.id DESC`,
      [aliasId]
    );
    return rows;
  }
}
