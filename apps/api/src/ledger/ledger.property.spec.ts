import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import fc from "fast-check";
import { Pool } from "pg";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";
import { createTestMember, deleteTestMember } from "../test-fixtures";
import { LedgerService } from "./ledger.service";

/**
 * SPEC.md §12 Phase 7: "ledger math property-tested (never unbalanced)".
 * Random sequences of credits/debits, including deliberate over-drafts that
 * the DB's own CHECK constraint must reject — the invariant under test is
 * the one §15 actually promises: token_ledger's sum and members.token_balance
 * never drift apart, and the balance never goes negative, no matter what
 * sequence of operations was attempted (successful or rejected).
 */
describe("token_ledger property tests (SPEC.md §12 Phase 7 / §19F)", () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  const ledger = new LedgerService();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("balance == SUM(token_ledger) and balance never negative, across random credit/debit sequences", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: -50, max: 50 }).filter((n) => n !== 0), {
          minLength: 1,
          maxLength: 25,
        }),
        async (deltas) => {
          const member = await createTestMember(pool, jwt);
          try {
            for (const [i, delta] of deltas.entries()) {
              try {
                await withTransaction(pool, (client) =>
                  ledger.creditTokens({
                    client,
                    aliasId: member.aliasId,
                    entry: delta >= 0 ? "earn_bonus" : "redeem_offer",
                    tokens: delta,
                    refType: "property-test",
                    refId: `${member.aliasId}-${i}`,
                  })
                );
              } catch {
                // Expected for deliberate over-drafts: the CHECK constraint
                // (token_balance >= 0) rejects the UPDATE, withTransaction
                // rolls the whole thing back — ledger row and balance both
                // untouched, which is exactly the invariant below checks for.
              }
            }

            const { rows: sumRows } = await pool.query<{ sum: string }>(
              `SELECT COALESCE(SUM(tokens), 0) AS sum FROM token_ledger WHERE alias_id = $1`,
              [member.aliasId]
            );
            const { rows: balRows } = await pool.query<{ token_balance: number }>(
              `SELECT token_balance FROM members WHERE alias_id = $1`,
              [member.aliasId]
            );

            expect(balRows[0].token_balance).toBe(Number(sumRows[0].sum));
            expect(balRows[0].token_balance).toBeGreaterThanOrEqual(0);
          } finally {
            await deleteTestMember(pool, member.aliasId);
          }
        }
      ),
      { numRuns: 25 }
    );
  }, 60_000);

  it("a rejected over-draft never creates a ledger row (all-or-nothing, not partial)", async () => {
    const member = await createTestMember(pool, jwt);
    // token_ledger's UNIQUE(ref_type, ref_id) is global, not per-alias, and
    // ledger rows are immutable — so ref_id must be unique per test RUN, not
    // just per alias, or a rerun silently treats "credit" as an already-seen
    // duplicate and skips crediting anything.
    const seedRefId = `seed-${member.aliasId}`;
    const overdraftRefId = `overdraft-${member.aliasId}`;
    try {
      await withTransaction(pool, (client) =>
        ledger.creditTokens({
          client,
          aliasId: member.aliasId,
          entry: "earn_bonus",
          tokens: 10,
          refType: "property-test",
          refId: seedRefId,
        })
      );

      await expect(
        withTransaction(pool, (client) =>
          ledger.creditTokens({
            client,
            aliasId: member.aliasId,
            entry: "redeem_offer",
            tokens: -20,
            refType: "property-test",
            refId: overdraftRefId,
          })
        )
      ).rejects.toThrow();

      const { rows } = await pool.query<{ count: string }>(
        `SELECT count(*) FROM token_ledger WHERE alias_id = $1 AND ref_id = $2`,
        [member.aliasId, overdraftRefId]
      );
      expect(Number(rows[0].count)).toBe(0);

      const { rows: balRows } = await pool.query<{ token_balance: number }>(
        `SELECT token_balance FROM members WHERE alias_id = $1`,
        [member.aliasId]
      );
      expect(balRows[0].token_balance).toBe(10); // untouched by the rejected debit
    } finally {
      await deleteTestMember(pool, member.aliasId);
    }
  });
});
