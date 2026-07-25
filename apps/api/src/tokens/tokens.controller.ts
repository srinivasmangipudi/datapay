import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { AliasAuthGuard, AliasRequest } from "../auth/alias-auth.guard";

interface LedgerRow {
  entry: string;
  tokens: number;
  ref_type: string;
  ref_id: string;
  created_at: Date;
  question_text_en: string | null;
  question_text_kn: string | null;
  snap_category: string | null;
  snap_category_kn: string | null;
  product_name: string | null;
  product_name_kn: string | null;
}

// Human-readable label per ledger row — what the raw entry/ref_type columns
// mean is only ever obvious from the code that wrote them (§15's payments-
// infrastructure posture keeps that data minimal), so the mobile app used to
// just show the prettified entry type ("earn response") for every row with
// no way to tell one from another. This resolves each row against whatever
// it was actually for.
function labelFor(r: LedgerRow): { en: string; kn: string } {
  if (r.question_text_en) {
    return { en: `Answered: ${r.question_text_en}`, kn: r.question_text_kn ? `ಉತ್ತರಿಸಿದ್ದು: ${r.question_text_kn}` : `Answered: ${r.question_text_en}` };
  }
  if (r.snap_category) {
    return {
      en: `Photo: ${r.snap_category}`,
      kn: r.snap_category_kn ? `ಫೋಟೋ: ${r.snap_category_kn}` : `Photo: ${r.snap_category}`,
    };
  }
  if (r.product_name) {
    return {
      en: `Redeemed on ${r.product_name}`,
      kn: r.product_name_kn ? `${r.product_name_kn} ಮೇಲೆ ಬಳಸಲಾಗಿದೆ` : `Redeemed on ${r.product_name}`,
    };
  }
  const fallback = r.entry.replace(/_/g, " ");
  return { en: fallback, kn: fallback };
}

@Controller("v1/tokens")
@UseGuards(AliasAuthGuard)
export class TokensController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async get(@Req() req: AliasRequest) {
    const { rows: memberRows } = await this.pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [req.aliasId]
    );
    // SPEC.md §40 — outstanding (token_balance, the empty-diamond amount
    // still owed) vs. realised: tokens this member redeemed on an offer that
    // actually reached 'delivered' — the same bar the reserve itself uses,
    // not just "redeemed."
    const { rows: realisedRows } = await this.pool.query<{ realised: string }>(
      `SELECT COALESCE(SUM(tokens_redeemed), 0) AS realised
       FROM offer_participation WHERE alias_id = $1 AND state = 'delivered'`,
      [req.aliasId]
    );
    const { rows: ledgerRows } = await this.pool.query<LedgerRow>(
      `SELECT tl.entry, tl.tokens, tl.ref_type, tl.ref_id, tl.created_at,
              q.text_en AS question_text_en, qt.text AS question_text_kn,
              sc.name AS snap_category, sc.name_kn AS snap_category_kn,
              p.display_name AS product_name, p.display_name_kn AS product_name_kn
       FROM token_ledger tl
       -- CASE, not "ref_type = ... AND ref_id::int = ...": Postgres doesn't
       -- guarantee left-to-right short-circuit for plain ANDed quals (the
       -- planner can reorder them), but a CASE's WHEN is always evaluated
       -- before its THEN — the only safe way to guard a cast that could
       -- otherwise blow up on a non-numeric ref_id from an unrelated entry.
       LEFT JOIN responses r
         ON r.id = CASE WHEN tl.ref_type = 'response' AND tl.ref_id ~ '^[0-9]+$' THEN tl.ref_id::int END
       LEFT JOIN questions q ON q.id = r.question_id
       LEFT JOIN question_translations qt ON qt.question_id = q.id AND qt.language_code = 'kn'
       LEFT JOIN snaps sn
         ON sn.id = CASE WHEN tl.ref_type = 'snap' AND tl.ref_id ~ '^[0-9]+$' THEN tl.ref_id::int END
       LEFT JOIN categories sc ON sc.id = sn.category_id
       LEFT JOIN offer_participation op
         ON op.id = CASE WHEN tl.ref_type = 'offer_participation' AND tl.ref_id ~ '^[0-9]+$' THEN tl.ref_id::int END
       LEFT JOIN offers o ON o.id = op.offer_id
       LEFT JOIN products p ON p.product_code = o.product_code
       WHERE tl.alias_id = $1
       ORDER BY tl.created_at DESC LIMIT 50`,
      [req.aliasId]
    );

    return {
      balance: memberRows[0]?.token_balance ?? 0,
      realisedTokens: Number(realisedRows[0].realised),
      history: ledgerRows.map((r) => {
        const label = labelFor(r);
        return {
          entry: r.entry,
          tokens: r.tokens,
          refType: r.ref_type,
          refId: r.ref_id,
          createdAt: r.created_at,
          label: label.en,
          labelKn: label.kn,
        };
      }),
    };
  }
}
