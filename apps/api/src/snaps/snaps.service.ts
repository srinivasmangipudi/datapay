import { Inject, Injectable } from "@nestjs/common";
import type { SnapDto } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
import { LedgerService } from "../ledger/ledger.service";
import { DevNoopStorageProvider, StorageProvider } from "./storage.provider";

interface SnapRow {
  id: number;
  state: string;
  reward_tokens: number;
  captured_at: Date;
  product_code: string | null;
}

@Injectable()
export class SnapsService {
  private readonly storage: StorageProvider = new DevNoopStorageProvider();

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly ledger: LedgerService
  ) {}

  async submit(aliasId: string, dto: SnapDto) {
    // On-device EXIF-strip + face-check already happened client-side (SPEC.md §8.4)
    // before this ever reaches the network — this endpoint trusts that contract.
    const { storageKey } = await this.storage.store(dto.imageBase64);

    return withTransaction(this.pool, async (client) => {
      const { rows: inserted } = await client.query<{ id: number; reward_tokens: number }>(
        `INSERT INTO snaps (alias_id, storage_key, category_id, client_msg_id, captured_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (client_msg_id) DO NOTHING
         RETURNING id, reward_tokens`,
        [aliasId, storageKey, dto.categoryId ?? null, dto.clientMsgId, dto.capturedAt]
      );

      if (!inserted[0]) {
        return { status: "already_synced" as const };
      }

      await this.ledger.creditTokens({
        client,
        aliasId,
        entry: "earn_snap",
        tokens: inserted[0].reward_tokens,
        refType: "snap",
        refId: inserted[0].id,
      });

      return { status: "credited" as const, snapId: inserted[0].id };
    });
  }

  async list(aliasId: string) {
    const { rows } = await this.pool.query<SnapRow>(
      `SELECT id, state, reward_tokens, captured_at, product_code FROM snaps
       WHERE alias_id = $1 ORDER BY captured_at DESC`,
      [aliasId]
    );
    return rows.map((s) => ({
      id: s.id,
      state: s.state,
      rewardTokens: s.reward_tokens,
      capturedAt: s.captured_at,
      productCode: s.product_code,
    }));
  }
}
