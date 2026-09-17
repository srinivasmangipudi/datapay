import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateOrgProductDto, UpdateOrgProductDto } from "@datapay/shared";
import { Pool, PoolClient } from "pg";
import { z } from "zod";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
import { stripCodeFences } from "../intelligence/llm-json.util";
import { GeminiLlmProvider, LlmProvider } from "../intelligence/llm.provider";
import { ExtractedProduct, ExtractedProductSchema } from "./extracted-product.schema";
import { fetchSheetText } from "./sheet.provider";
import { S3StorageProvider, StorageProvider } from "../snaps/storage.provider";

// Sheet content is pasted straight into the prompt — capped so a huge sheet
// doesn't blow the model's context window; generous enough for a few hundred
// rows of a typical product catalog.
const MAX_SHEET_CHARS = 40_000;

function normalizeDedupKey(nameEn: string): string {
  return nameEn.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildExtractionPrompt(sheetText: string): string {
  return `You are extracting a structured product catalog from a raw spreadsheet export for an
Indian household-goods marketplace. The sheet may be messy, inconsistently formatted, or use
whatever column names/order the seller happened to use — infer intent rather than expecting a
fixed layout.

Raw sheet content:
"""
${sheetText.slice(0, MAX_SHEET_CHARS)}
"""

For EACH distinct row that looks like a real sellable product, extract:
- nameEn: a clean product name
- unitSpec: the pack size/unit if shown (e.g. "1kg", "500ml", "1 dozen") — omit the field entirely if not present
- marketPricePaise: the regular/list price, in paise (multiply a rupee amount by 100)
- salePricePaise: the actual selling price, in paise — if the sheet only has one price column, use that same value for both marketPricePaise and salePricePaise
- quantityAvailable: stock count as a whole number — use 0 if not shown
- photoUrl: an image URL if one column clearly contains one — omit the field entirely otherwise

Skip rows that are headers, blank, subtotals, or not real individual products.

Respond with ONLY a JSON array (no markdown fences, no commentary) matching exactly this shape:
[
  {"nameEn": "...", "unitSpec": "...", "marketPricePaise": 5000, "salePricePaise": 4500, "quantityAvailable": 20, "photoUrl": "..."}
]`;
}

export interface OrgProductRow {
  id: number;
  category_id: number | null;
  name_en: string;
  name_kn: string | null;
  description_en: string | null;
  unit_spec: string | null;
  market_price_paise: number;
  sale_price_paise: number;
  quantity_available: number;
  photo_url: string | null;
  source: string;
  review_state: string;
  zone_id: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class OrgProductsService {
  private llmInstance: LlmProvider | null = null;
  private storageInstance: StorageProvider | null = null;
  llmOverride: LlmProvider | null = null;
  storageOverride: StorageProvider | null = null;
  // Test seam — avoids a real network fetch in tests, same shape as llmOverride.
  sheetFetchOverride: ((url: string) => Promise<string>) | null = null;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private get llm(): LlmProvider {
    if (this.llmOverride) return this.llmOverride;
    if (!this.llmInstance) {
      try {
        this.llmInstance = new GeminiLlmProvider();
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
    }
    return this.llmInstance;
  }

  // Lazy, same posture as `llm` above — a missing S3 config fails loudly
  // only when a photo is actually uploaded, not at app boot, and never
  // silently falls back to the dev-noop provider (a photo upload that
  // "succeeds" but discards the image would be actively misleading here,
  // unlike pulse/snap answers where the photo was never the point).
  private get storage(): StorageProvider {
    if (this.storageOverride) return this.storageOverride;
    if (!this.storageInstance) {
      try {
        this.storageInstance = new S3StorageProvider();
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
    }
    return this.storageInstance;
  }

  // Fetches an external image URL and re-hosts it through our own storage,
  // so a listing doesn't rot if the org's original sheet link disappears
  // later. Best-effort — a bad/unreachable photo URL shouldn't fail the
  // whole import over one product's picture.
  private async rehostPhoto(url: string): Promise<string | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      const { storageKey } = await this.storage.store(buffer.toString("base64"));
      return storageKey;
    } catch {
      return null;
    }
  }

  /**
   * Points at a public sheet (Google Sheets share link, or any plain CSV
   * URL), extracts a product list via the LLM, and upserts every product by
   * (organization_id, dedup_key) — a genuinely new product lands as 'draft'
   * (needs ops review); a re-import matching an already-approved product
   * updates quantity/price/photo in place without re-entering review.
   */
  async importFromSheet(organizationId: string, sheetUrl: string): Promise<{ runId: number }> {
    const { rows: runRows } = await this.pool.query<{ id: number }>(
      `INSERT INTO org_product_import_runs (organization_id, source_url, status) VALUES ($1, $2, 'running') RETURNING id`,
      [organizationId, sheetUrl]
    );
    const runId = runRows[0].id;

    try {
      const sheetText = await (this.sheetFetchOverride ?? fetchSheetText)(sheetUrl);

      let raw: string;
      try {
        raw = await this.llm.complete(buildExtractionPrompt(sheetText), { maxTokens: 8192 });
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }

      let extracted: ExtractedProduct[];
      try {
        extracted = z.array(ExtractedProductSchema).parse(JSON.parse(stripCodeFences(raw)));
      } catch (err) {
        throw new BadRequestException(
          `Couldn't parse the model's response as the expected JSON shape: ${(err as Error).message}`
        );
      }
      if (extracted.length === 0) {
        throw new BadRequestException("No products could be extracted from that sheet");
      }

      // Photo re-hosting is real network I/O — done outside the DB
      // transaction, same posture pulse.service.ts uses for photo storage.
      const withRehostedPhotos = await Promise.all(
        extracted.map(async (p) => ({
          ...p,
          photoUrl: p.photoUrl ? await this.rehostPhoto(p.photoUrl) : null,
        }))
      );

      const { created, updated } = await withTransaction(this.pool, async (client: PoolClient) => {
        let created = 0;
        let updated = 0;
        for (const p of withRehostedPhotos) {
          const { rows } = await client.query<{ inserted: boolean }>(
            `INSERT INTO org_products
               (organization_id, name_en, unit_spec, market_price_paise, sale_price_paise,
                quantity_available, photo_url, dedup_key, source, review_state, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sheet_extracted', 'draft', now())
             ON CONFLICT (organization_id, dedup_key) DO UPDATE SET
               name_en = EXCLUDED.name_en,
               unit_spec = EXCLUDED.unit_spec,
               market_price_paise = EXCLUDED.market_price_paise,
               sale_price_paise = EXCLUDED.sale_price_paise,
               quantity_available = EXCLUDED.quantity_available,
               photo_url = COALESCE(EXCLUDED.photo_url, org_products.photo_url),
               updated_at = now()
             RETURNING (xmax = 0) AS inserted`,
            [
              organizationId,
              p.nameEn,
              p.unitSpec ?? null,
              p.marketPricePaise,
              p.salePricePaise,
              p.quantityAvailable,
              p.photoUrl,
              normalizeDedupKey(p.nameEn),
            ]
          );
          if (rows[0].inserted) created += 1;
          else updated += 1;
        }
        return { created, updated };
      });

      await this.pool.query(
        `UPDATE org_product_import_runs
         SET status = 'completed', products_found = $1, products_created = $2, products_updated = $3
         WHERE id = $4`,
        [extracted.length, created, updated, runId]
      );
      return { runId };
    } catch (err) {
      await this.pool.query(
        `UPDATE org_product_import_runs SET status = 'failed', error_message = $1 WHERE id = $2`,
        [(err as Error).message, runId]
      );
      throw err;
    }
  }

  async listImportRuns(organizationId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, source_url, status, products_found, products_created, products_updated, error_message, created_at
       FROM org_product_import_runs WHERE organization_id = $1 ORDER BY id DESC LIMIT 10`,
      [organizationId]
    );
    return rows;
  }

  // A manually-typed product is still org-submitted content — same 'draft'
  // gate as a sheet-extracted one, consistent with how org_submitted
  // questions always land as 'draft' regardless of authoring method.
  async createProduct(organizationId: string, dto: CreateOrgProductDto): Promise<{ id: number }> {
    const { rows } = await this.pool.query<{ id: number }>(
      `INSERT INTO org_products
         (organization_id, category_id, name_en, name_kn, description_en, unit_spec,
          market_price_paise, sale_price_paise, quantity_available, dedup_key, source,
          review_state, zone_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual', 'draft', $11)
       RETURNING id`,
      [
        organizationId,
        dto.categoryId ?? null,
        dto.nameEn,
        dto.nameKn ?? null,
        dto.descriptionEn ?? null,
        dto.unitSpec ?? null,
        dto.marketPricePaise,
        dto.salePricePaise,
        dto.quantityAvailable,
        normalizeDedupKey(dto.nameEn),
        dto.zoneId ?? null,
      ]
    );
    return { id: rows[0].id };
  }

  // Editing price/quantity/etc never touches review_state — an
  // already-approved product stays approved through routine edits.
  async updateProduct(
    organizationId: string,
    productId: number,
    dto: UpdateOrgProductDto
  ): Promise<OrgProductRow> {
    const fields: Record<string, unknown> = { ...dto };
    if (dto.nameEn) fields.dedup_key = normalizeDedupKey(dto.nameEn);

    const columns: Record<string, string> = {
      nameEn: "name_en",
      nameKn: "name_kn",
      descriptionEn: "description_en",
      unitSpec: "unit_spec",
      categoryId: "category_id",
      marketPricePaise: "market_price_paise",
      salePricePaise: "sale_price_paise",
      quantityAvailable: "quantity_available",
      dedup_key: "dedup_key",
    };

    const setClauses: string[] = ["updated_at = now()"];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(fields)) {
      const column = columns[key];
      if (!column) continue;
      params.push(value);
      setClauses.push(`${column} = $${params.length}`);
    }

    params.push(productId, organizationId);
    const { rows } = await this.pool.query<OrgProductRow>(
      `UPDATE org_products SET ${setClauses.join(", ")}
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}
       RETURNING *`,
      params
    );
    if (!rows[0]) throw new NotFoundException(`Product ${productId} not found`);
    return rows[0];
  }

  async uploadPhoto(
    organizationId: string,
    productId: number,
    imageBase64: string
  ): Promise<{ photoUrl: string }> {
    const { storageKey } = await this.storage.store(imageBase64);
    const { rows } = await this.pool.query<{ photo_url: string }>(
      `UPDATE org_products SET photo_url = $1, updated_at = now()
       WHERE id = $2 AND organization_id = $3 RETURNING photo_url`,
      [storageKey, productId, organizationId]
    );
    if (!rows[0]) throw new NotFoundException(`Product ${productId} not found`);
    return { photoUrl: rows[0].photo_url };
  }

  async listOwnProducts(organizationId: string) {
    const { rows } = await this.pool.query<OrgProductRow>(
      `SELECT * FROM org_products WHERE organization_id = $1 ORDER BY id DESC`,
      [organizationId]
    );
    return rows;
  }

  // Never selects alias_id — an org sees only a relay_token for fulfillment,
  // identity-blind, same posture as offers/§7.
  async listOwnOrders(organizationId: string) {
    const { rows } = await this.pool.query(
      `SELECT po.id, op.name_en, po.quantity, po.unit_price_paise, po.relay_token, po.status, po.created_at
       FROM product_orders po
       JOIN org_products op ON op.id = po.org_product_id
       WHERE op.organization_id = $1
       ORDER BY po.id DESC`,
      [organizationId]
    );
    return rows;
  }

  // --- Ops-facing (mirrors QuestionFeederService.review()) ---

  async listPendingReview() {
    const { rows } = await this.pool.query(
      `SELECT p.*, o.name AS organization_name
       FROM org_products p
       JOIN organizations o ON o.id = p.organization_id
       WHERE p.review_state = 'draft'
       ORDER BY p.id`
    );
    return rows;
  }

  async review(productId: number, decision: "approved" | "rejected") {
    const { rows } = await this.pool.query(
      `UPDATE org_products SET review_state = $1, updated_at = now()
       WHERE id = $2 AND review_state = 'draft' RETURNING id, review_state`,
      [decision, productId]
    );
    if (!rows[0]) throw new NotFoundException(`Draft product ${productId} not found`);
    return rows[0];
  }

  // Ops only ever needs the relay_token to resolve delivery info via the
  // existing POST /v1/relay/resolve proxy — never alias_id.
  async listAllOrdersForOps() {
    const { rows } = await this.pool.query(
      `SELECT po.id, op.name_en, o.name AS organization_name, po.quantity, po.relay_token,
              po.status, po.created_at
       FROM product_orders po
       JOIN org_products op ON op.id = po.org_product_id
       JOIN organizations o ON o.id = op.organization_id
       ORDER BY po.id DESC LIMIT 100`
    );
    return rows;
  }
}
