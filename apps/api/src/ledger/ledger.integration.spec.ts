import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
import { createTestMember, deleteTestMember, TestMember } from "../test-fixtures";
import { LedgerService } from "./ledger.service";

describe("LedgerService — payments-infrastructure guarantees (SPEC.md §15)", () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  let ledger: LedgerService;
  let member: TestMember;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
    ledger = app.get(LedgerService);
    member = await createTestMember(pool, jwt);
  });

  afterAll(async () => {
    await deleteTestMember(pool, member.aliasId);
    await app.close();
    await pool.end();
  });

  it("§15B: rejects UPDATE on token_ledger at the database level", async () => {
    await withTransaction(pool, async (client) => {
      await ledger.creditTokens({
        client,
        aliasId: member.aliasId,
        entry: "earn_bonus",
        tokens: 1,
        refType: "test-immutability",
        refId: randomUUID(),
      });
    });

    await expect(
      pool.query(`UPDATE token_ledger SET tokens = 999 WHERE alias_id = $1`, [member.aliasId])
    ).rejects.toThrow(/append-only/);
  });

  it("§15B: rejects DELETE on token_ledger at the database level", async () => {
    await expect(
      pool.query(`DELETE FROM token_ledger WHERE alias_id = $1`, [member.aliasId])
    ).rejects.toThrow(/append-only/);
  });

  it("§15C: is idempotent — crediting the same (refType, refId) twice only credits once", async () => {
    const before = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    const refId = randomUUID();

    const creditOnce = () =>
      withTransaction(pool, (client) =>
        ledger.creditTokens({
          client,
          aliasId: member.aliasId,
          entry: "earn_bonus",
          tokens: 10,
          refType: "test-idempotency",
          refId,
        })
      );

    const first = await creditOnce();
    const second = await creditOnce();

    expect(first.credited).toBe(true);
    expect(second.credited).toBe(false);

    const after = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    expect(after.rows[0].token_balance - before.rows[0].token_balance).toBe(10);

    const { rows: ledgerRows } = await pool.query(
      `SELECT id FROM token_ledger WHERE ref_type = 'test-idempotency' AND ref_id = $1`,
      [refId]
    );
    expect(ledgerRows).toHaveLength(1);
  });

  it("§15D: members.token_balance never goes negative under concurrent credits", async () => {
    const before = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );

    const runId = randomUUID();
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        withTransaction(pool, (client) =>
          ledger.creditTokens({
            client,
            aliasId: member.aliasId,
            entry: "earn_bonus",
            tokens: 3,
            refType: "test-concurrency",
            refId: `${runId}-${i}`,
          })
        )
      )
    );

    const after = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    expect(after.rows[0].token_balance).toBeGreaterThanOrEqual(0);
    expect(after.rows[0].token_balance - before.rows[0].token_balance).toBe(15);

    const { rows: sumRows } = await pool.query<{ sum: string }>(
      `SELECT COALESCE(SUM(tokens), 0) AS sum FROM token_ledger WHERE alias_id = $1`,
      [member.aliasId]
    );
    expect(Number(sumRows[0].sum)).toBe(after.rows[0].token_balance);
  });
});
