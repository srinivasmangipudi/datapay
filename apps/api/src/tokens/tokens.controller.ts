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
    const { rows: ledgerRows } = await this.pool.query<LedgerRow>(
      `SELECT entry, tokens, ref_type, ref_id, created_at FROM token_ledger
       WHERE alias_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.aliasId]
    );

    return {
      balance: memberRows[0]?.token_balance ?? 0,
      history: ledgerRows.map((r) => ({
        entry: r.entry,
        tokens: r.tokens,
        refType: r.ref_type,
        refId: r.ref_id,
        createdAt: r.created_at,
      })),
    };
  }
}
