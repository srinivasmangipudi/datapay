import { BadRequestException, HttpException, Inject, Injectable } from "@nestjs/common";
import type { ProduceListingDto, ProducerProfileDto } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

@Injectable()
export class ProduceService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async registerProfile(aliasId: string, dto: ProducerProfileDto) {
    await this.pool.query(
      `INSERT INTO producer_profiles (alias_id, kind, shg_id, capacity_note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (alias_id) DO UPDATE SET
         kind = EXCLUDED.kind, shg_id = EXCLUDED.shg_id, capacity_note = EXCLUDED.capacity_note`,
      [aliasId, dto.kind, dto.shgId ?? null, dto.capacityNote ?? null]
    );
    return { ok: true };
  }

  async createListing(aliasId: string, dto: ProduceListingDto) {
    const { rows: profileRows } = await this.pool.query(
      `SELECT alias_id FROM producer_profiles WHERE alias_id = $1 AND active = true`,
      [aliasId]
    );
    if (!profileRows[0]) {
      throw new BadRequestException("Register a producer profile before listing produce");
    }

    const { rows } = await this.pool.query<{ id: number }>(
      `INSERT INTO produce_listings
         (alias_id, produce_category_id, qty, unit, quality_note, ready_at, snap_ids, input_mode, asking_price_paise)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        aliasId,
        dto.produceCategoryId,
        dto.qty,
        dto.unit,
        dto.qualityNote ?? null,
        dto.readyAt ?? null,
        dto.snapIds ?? null,
        dto.inputMode,
        dto.askingPricePaise ?? null,
      ]
    );
    return { id: rows[0].id };
  }

  async valueAddSuggestions(categoryId: number) {
    const { rows } = await this.pool.query<{
      id: number;
      suggestion_en: string;
      suggestion_kn: string | null;
      uplift_note: string | null;
    }>(
      `SELECT id, suggestion_en, suggestion_kn, uplift_note FROM valueadd_suggestions
       WHERE produce_category_id = $1 AND approved = true`,
      [categoryId]
    );
    return rows.map((r) => ({
      id: r.id,
      suggestionEn: r.suggestion_en,
      suggestionKn: r.suggestion_kn,
      upliftNote: r.uplift_note,
    }));
  }

  // Thin proxy to Vault, same posture as the delivery-address proxy (§7/§16).
  async setPayoutInstrument(aliasId: string, upiId: string) {
    const vaultUrl = process.env.VAULT_INTERNAL_URL;
    if (!vaultUrl) throw new Error("Missing VAULT_INTERNAL_URL");
    const res = await fetch(`${vaultUrl}/payout-instrument`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliasId, upiId }),
    });
    const data = await res.json();
    if (!res.ok) throw new HttpException(data, res.status);
    return data;
  }
}
