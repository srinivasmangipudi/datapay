import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.module";

export type AuditActorType = "admin" | "system";

// SPEC.md §5 target schema names `audit_log` alongside `quality_flags` —
// append-only (§19), same discipline as the money ledgers. Every
// admin-triggered job (matching runs, payout runs, snap verification) writes
// one row here so "what ran, and when" is itself auditable, not just implied
// by side effects in other tables.
@Injectable()
export class AuditService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async record(
    actorType: AuditActorType,
    actorId: string | null,
    action: string,
    object: string,
    client?: PoolClient
  ): Promise<void> {
    const runner = client ?? this.pool;
    await runner.query(
      `INSERT INTO audit_log (actor_type, actor_id, action, object) VALUES ($1, $2, $3, $4)`,
      [actorType, actorId, action, object]
    );
  }

  /**
   * A flat, single CSV across every real-money movement (§19D) — the three
   * tables have different shapes (alias vs zone, tokens vs paise), unified
   * into one common row so an auditor gets one export, not three. Every
   * source table is alias/zone-keyed only, same as everywhere else in
   * core_db — an export can never carry a phone number because core_db
   * never has one (LAW 1).
   */
  async exportCsv(since: Date): Promise<string> {
    const { rows } = await this.pool.query<{
      source: string;
      subject_id: string;
      entry: string;
      amount: number;
      ref_type: string;
      ref_id: string;
      at: Date;
    }>(
      `SELECT 'token_ledger' AS source, alias_id AS subject_id, entry, tokens AS amount,
              ref_type, ref_id, created_at AS at
       FROM token_ledger WHERE created_at >= $1
       UNION ALL
       SELECT 'fund_ledger' AS source, zone_id::text AS subject_id, entry, amount_paise AS amount,
              ref_type, ref_id, created_at AS at
       FROM fund_ledger WHERE created_at >= $1
       UNION ALL
       SELECT 'producer_payout' AS source, alias_id AS subject_id, status AS entry, amount_paise AS amount,
              'linkage' AS ref_type, linkage_id::text AS ref_id, initiated_at AS at
       FROM producer_payouts WHERE initiated_at >= $1
       ORDER BY at ASC`,
      [since.toISOString()]
    );

    const header = "source,subject_id,entry,amount,ref_type,ref_id,at";
    const csvField = (value: string | number) => {
      const s = String(value);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) =>
      [r.source, r.subject_id, r.entry, r.amount, r.ref_type, r.ref_id, r.at.toISOString()]
        .map(csvField)
        .join(",")
    );
    return [header, ...lines].join("\n");
  }
}
