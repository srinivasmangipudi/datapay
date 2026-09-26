import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateCategoryDto } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";

/**
 * Every column in core_db that points at categories.id, enumerated rather
 * than discovered at runtime: a merge has to move all of them or the delete
 * fails on a RESTRICT foreign key, and a new reference added later should
 * force someone to think about what merging means for it rather than being
 * silently swept along. `categories-merge.integration.spec.ts` asserts this
 * list still matches the live schema, so adding an FK breaks that test.
 *
 * `consents` is deliberately absent — it has a UNIQUE (alias_id, category_id)
 * and needs collision handling, so it's done separately below.
 */
const CATEGORY_REFERENCES: ReadonlyArray<{ table: string; column: string }> = [
  { table: "consent_events", column: "category_id" },
  { table: "demand_aggregates", column: "category_id" },
  { table: "intents", column: "product_category_id" },
  { table: "org_products", column: "category_id" },
  { table: "products", column: "category_id" },
  { table: "question_topics", column: "category_id" },
  { table: "questions", column: "category_id" },
  { table: "responses", column: "recognized_category_id" },
  { table: "snaps", column: "category_id" },
  { table: "snaps", column: "recognized_category_id" },
];

export interface CategoryUsage {
  id: number;
  name: string;
  slug: string;
  /** Per-table reference counts, only including tables that have any. */
  references: Array<{ table: string; column: string; count: number }>;
  total: number;
}

export interface MergeResult {
  movedFrom: { id: number; name: string };
  into: { id: number; name: string };
  moved: Array<{ table: string; column: string; count: number }>;
  /** Consent rows dropped because the member already had one on the target. */
  consentsCollapsed: number;
  /** Members whose consent was narrowed to denied by the collapse. */
  consentsNarrowedToDenied: number;
}

// A name -> slug derivation, not a validation — free text becomes a stable
// identifier (lowercase, hyphenated, alphanumeric only) without asking the
// admin to think about slugs at all.
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

@Injectable()
export class CategoriesService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list() {
    const { rows } = await this.pool.query(
      `SELECT id, slug, name, name_kn, sensitivity FROM categories ORDER BY name`
    );
    return rows;
  }

  /**
   * Find-or-create by slug (SPEC.md §26) — an admin typing a category name
   * inline in a wizard should never hit a duplicate-slug error, and typing
   * the same name a second time must resolve to the same category, not a
   * second row with a suffixed slug.
   */
  async create(dto: CreateCategoryDto): Promise<{ id: number; created: boolean }> {
    const slug = dto.slug?.trim() || slugify(dto.name);

    // ON CONFLICT DO NOTHING, not select-then-insert — two concurrent
    // requests for the same brand-new name both racing this could otherwise
    // both miss the SELECT and then have one of them fail on the slug's
    // UNIQUE constraint instead of resolving to the same row.
    const { rows: inserted } = await this.pool.query<{ id: number }>(
      `INSERT INTO categories (slug, name, name_kn, sensitivity) VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id`,
      [slug, dto.name, dto.nameKn ?? null, dto.sensitivity ?? "standard"]
    );
    if (inserted[0]) {
      return { id: inserted[0].id, created: true };
    }

    const { rows: existing } = await this.pool.query<{ id: number }>(
      `SELECT id FROM categories WHERE slug = $1`,
      [slug]
    );
    return { id: existing[0].id, created: false };
  }

  /** What a merge would move — shown before confirming, since it can't be undone. */
  async usage(id: number): Promise<CategoryUsage> {
    const { rows } = await this.pool.query<{ id: number; name: string; slug: string }>(
      `SELECT id, name, slug FROM categories WHERE id = $1`,
      [id]
    );
    if (!rows[0]) throw new NotFoundException(`Category ${id} not found`);

    const references: CategoryUsage["references"] = [];
    for (const ref of [...CATEGORY_REFERENCES, { table: "consents", column: "category_id" }]) {
      const { rows: c } = await this.pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${ref.table} WHERE ${ref.column} = $1`,
        [id]
      );
      const count = Number(c[0].count);
      if (count > 0) references.push({ table: ref.table, column: ref.column, count });
    }

    return {
      ...rows[0],
      references,
      total: references.reduce((sum, r) => sum + r.count, 0),
    };
  }

  /**
   * Repoint everything that references `sourceId` at `targetId`, then delete
   * the source. One transaction: a half-moved merge would leave rows split
   * across a category that no longer exists.
   *
   * Not reversible — `usage()` exists so ops can see the blast radius first.
   */
  async merge(sourceId: number, targetId: number): Promise<MergeResult> {
    if (sourceId === targetId) {
      throw new BadRequestException("Can't merge a category into itself");
    }

    return withTransaction(this.pool, async (client) => {
      const { rows: found } = await client.query<{ id: number; name: string }>(
        `SELECT id, name FROM categories WHERE id = ANY($1::int[]) FOR UPDATE`,
        [[sourceId, targetId]]
      );
      const source = found.find((c) => c.id === sourceId);
      const target = found.find((c) => c.id === targetId);
      if (!source) throw new NotFoundException(`Category ${sourceId} not found`);
      if (!target) throw new NotFoundException(`Category ${targetId} not found`);

      // Consents first, because UNIQUE (alias_id, category_id) means a member
      // holding a row on BOTH categories can't simply be repointed.
      //
      // Where both exist the surviving row is the AND of the two: a merge is
      // ops housekeeping, and it must never widen what a member agreed to
      // share. Someone who denied the category being merged away keeps that
      // denial on the survivor.
      const { rows: narrowed } = await client.query<{ count: string }>(
        `UPDATE consents t
            SET granted = false, updated_at = now()
           FROM consents s
          WHERE s.category_id = $1 AND t.category_id = $2
            AND s.alias_id = t.alias_id
            AND s.granted = false AND t.granted = true
      RETURNING 1 AS count`,
        [sourceId, targetId]
      );
      const { rows: collapsed } = await client.query<{ count: string }>(
        `DELETE FROM consents s
          WHERE s.category_id = $1
            AND EXISTS (SELECT 1 FROM consents t WHERE t.category_id = $2 AND t.alias_id = s.alias_id)
      RETURNING 1 AS count`,
        [sourceId, targetId]
      );
      // Whatever is left has no counterpart on the target, so it can move.
      await client.query(`UPDATE consents SET category_id = $2 WHERE category_id = $1`, [
        sourceId,
        targetId,
      ]);

      const moved: MergeResult["moved"] = [];
      for (const ref of CATEGORY_REFERENCES) {
        const { rowCount } = await client.query(
          `UPDATE ${ref.table} SET ${ref.column} = $2 WHERE ${ref.column} = $1`,
          [sourceId, targetId]
        );
        if (rowCount) moved.push({ table: ref.table, column: ref.column, count: rowCount });
      }

      await client.query(`DELETE FROM categories WHERE id = $1`, [sourceId]);

      return {
        movedFrom: { id: source.id, name: source.name },
        into: { id: target.id, name: target.name },
        moved,
        consentsCollapsed: collapsed.length,
        consentsNarrowedToDenied: narrowed.length,
      };
    });
  }
}
