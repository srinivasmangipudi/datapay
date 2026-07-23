import { Injectable } from "@nestjs/common";
import { PoolClient } from "pg";

export type TokenLedgerEntry =
  | "earn_response"
  | "earn_snap"
  | "earn_voice"
  | "earn_intent"
  | "earn_bonus"
  | "redeem_offer"
  | "expire"
  | "adjustment";

export interface CreditTokensParams {
  client: PoolClient;
  aliasId: string;
  entry: TokenLedgerEntry;
  tokens: number;
  refType: string;
  refId: string | number;
}

// SPEC.md §15 — token_ledger is payments infrastructure, not an activity log.
// Every credit here MUST run inside the caller's transaction, alongside the
// source-row insert it's paying out for (§15A). Never called standalone.
@Injectable()
export class LedgerService {
  /**
   * Idempotent by (refType, refId) — the same unique constraint the source row's
   * own client_msg_id already enforces. A retried offline sync hits 23505 and this
   * is a clean no-op: never a duplicate ledger row, never a double balance bump.
   */
  async creditTokens(params: CreditTokensParams): Promise<{ credited: boolean }> {
    const { client, aliasId, entry, tokens, refType, refId } = params;

    try {
      await client.query(
        `INSERT INTO token_ledger (alias_id, entry, tokens, ref_type, ref_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [aliasId, entry, tokens, refType, String(refId)]
      );
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        return { credited: false };
      }
      throw err;
    }

    await client.query(`UPDATE members SET token_balance = token_balance + $1 WHERE alias_id = $2`, [
      tokens,
      aliasId,
    ]);
    return { credited: true };
  }
}
