import { Inject, Injectable } from "@nestjs/common";
import type { CreateCategoryDto } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

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
}
