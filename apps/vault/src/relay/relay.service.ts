import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { decryptSecret, encryptSecret } from "../crypto/secret-crypto.util";

@Injectable()
export class RelayService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async resolveUserId(aliasId: string): Promise<string> {
    const { rows } = await this.pool.query<{ user_id: string }>(
      `SELECT user_id FROM alias_map WHERE alias_id = $1`,
      [aliasId]
    );
    if (!rows[0]) throw new NotFoundException("Unknown alias");
    return rows[0].user_id;
  }

  /**
   * Appends a new address row rather than updating in place — deliberate.
   * relay_map FKs to a specific delivery_addresses row with ON DELETE RESTRICT,
   * so an order placed last month must still resolve to the address it was
   * actually delivered to, not wherever the member lives now.
   *
   * Unchanged text is a no-op though: the mobile client used to POST the
   * address on EVERY order, which appended an identical row each time and grew
   * the table for nothing.
   */
  async setDeliveryAddress(
    aliasId: string,
    address: string,
    zoneHint?: string
  ): Promise<{ ok: true }> {
    const userId = await this.resolveUserId(aliasId);

    const current = await this.latestAddress(userId);
    if (current !== null && current === address.trim()) {
      return { ok: true };
    }

    await this.pool.query(
      `INSERT INTO delivery_addresses (user_id, address_encrypted, zone_hint) VALUES ($1, $2, $3)`,
      [userId, encryptSecret(address.trim()), zoneHint ?? null]
    );
    return { ok: true };
  }

  private async latestAddress(userId: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ address_encrypted: string }>(
      `SELECT address_encrypted FROM delivery_addresses WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return rows[0] ? decryptSecret(rows[0].address_encrypted) : null;
  }

  /**
   * The member reading back their OWN address. Legitimate — they are
   * authenticated as this alias and it is their data (DPDP gives them the
   * right to see it) — but still a PII read, so it is logged like every other
   * one and returns nothing but the address itself.
   */
  async getDeliveryAddress(aliasId: string): Promise<{ address: string | null }> {
    const userId = await this.resolveUserId(aliasId);
    const address = await this.latestAddress(userId);

    if (address !== null) {
      await this.pool.query(
        `INSERT INTO vault_access_log (service, purpose, alias_or_token) VALUES ($1, $2, $3)`,
        ["vault", "read-own-delivery-address", aliasId]
      );
    }
    return { address };
  }

  // Called by Core at offer-join time (SPEC.md §7): registers what a relay
  // token resolves to, ahead of the PACS node ever asking. Vault controls
  // this mapping independently — Core can't make Vault trust an arbitrary
  // alias assertion at resolve time.
  async registerRelayMap(
    aliasId: string,
    relayToken: string,
    offerRef: string,
    expiresAt: string
  ): Promise<{ ok: true }> {
    const userId = await this.resolveUserId(aliasId);
    const { rows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM delivery_addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (!rows[0]) {
      throw new BadRequestException("Member has no delivery address on file");
    }
    await this.pool.query(
      `INSERT INTO relay_map (relay_token, delivery_address_id, offer_ref, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [relayToken, rows[0].id, offerRef, expiresAt]
    );
    return { ok: true };
  }

  // The PACS node's only window into Vault. Returns a decrypted address —
  // this is the one moment identity crosses the seal, and only to the node,
  // never to the supplier (SPEC.md §7). Every call is audited.
  async resolveRelay(relayToken: string): Promise<{ address: string; zoneHint: string | null }> {
    const { rows } = await this.pool.query<{
      address_encrypted: string;
      zone_hint: string | null;
      expires_at: Date;
    }>(
      `SELECT da.address_encrypted, da.zone_hint, rm.expires_at
       FROM relay_map rm
       JOIN delivery_addresses da ON da.id = rm.delivery_address_id
       WHERE rm.relay_token = $1`,
      [relayToken]
    );
    if (!rows[0]) throw new NotFoundException("Unknown or expired relay token");
    if (new Date(rows[0].expires_at).getTime() < Date.now()) {
      throw new NotFoundException("Unknown or expired relay token");
    }

    await this.pool.query(
      `INSERT INTO vault_access_log (service, purpose, alias_or_token) VALUES ($1, $2, $3)`,
      ["vault", "resolve-relay", relayToken]
    );

    return {
      address: decryptSecret(rows[0].address_encrypted),
      zoneHint: rows[0].zone_hint,
    };
  }
}
