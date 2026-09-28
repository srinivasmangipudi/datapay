import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";

interface CategoryConsentRow {
  id: number;
  slug: string;
  name: string;
  name_kn: string | null;
  granted: boolean | null;
  updated_at: Date | null;
}

@Injectable()
export class ConsentsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // No explicit row yet = granted by default (a member who's actively using the
  // app has an implicit basis to participate); the off-switch is what's absolute.
  async list(aliasId: string) {
    const { rows } = await this.pool.query<CategoryConsentRow>(
      // Only categories that are actually in play: ones with an approved
      // question, or ones this member has already made a decision about.
      //
      // Listing every row meant a member's Vault showed toggles for scratch
      // categories nobody would ever ask them about — noise that makes the
      // real controls harder to find, and which exposed half-finished internal
      // naming to members.
      //
      // The second half of the OR matters: a member who switched something off
      // must keep seeing it even if its questions are later retired, or their
      // own decision becomes invisible and unrevisable.
      `SELECT c.id, c.slug, c.name, c.name_kn, co.granted, co.updated_at
       FROM categories c
       LEFT JOIN consents co ON co.category_id = c.id AND co.alias_id = $1
       WHERE co.alias_id IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM questions q
             WHERE q.category_id = c.id AND q.review_state = 'approved'
          )
       ORDER BY c.id`,
      [aliasId]
    );
    return rows.map((r) => ({
      categoryId: r.id,
      slug: r.slug,
      name: r.name,
      nameKn: r.name_kn,
      granted: r.granted ?? true,
      updatedAt: r.updated_at,
    }));
  }

  async setConsent(aliasId: string, categoryId: number, granted: boolean) {
    return withTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO consents (alias_id, category_id, granted, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (alias_id, category_id) DO UPDATE SET granted = $3, updated_at = now()`,
        [aliasId, categoryId, granted]
      );
      await client.query(
        `INSERT INTO consent_events (alias_id, category_id, action) VALUES ($1, $2, $3)`,
        [aliasId, categoryId, granted ? "grant" : "revoke"]
      );
      return { categoryId, granted };
    });
  }
}
