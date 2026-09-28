import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { TOKEN_RATE_FLOOR_PAISE } from "@datapay/shared";
import { Pool } from "pg";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { TokenRateService } from "./token-rate.service";

describe("TokenRateService — honest inputs (SPEC.md §6C)", () => {
  let app: INestApplication;
  let pool: Pool;
  let tokenRate: TokenRateService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    tokenRate = app.get(TokenRateService);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("floors the rate while supplierCompetition is 0, whatever the other inputs are", async () => {
    const { ratePaise, inputs } = await tokenRate.computeAndPublish();

    // supplierCompetition is hardcoded 0 (no competing-bid mechanic exists),
    // and the formula MULTIPLIES the three factors — so the rate is pinned at
    // the floor no matter what the other two do. That invariant is the point
    // of this test.
    expect(inputs.supplierCompetition).toBe(0);
    expect(ratePaise).toBe(TOKEN_RATE_FLOOR_PAISE);

    // realisedSalesVelocity is deliberately NOT asserted to be 0. It reads
    // live data, and sibling suites legitimately confirm deliveries, so a
    // fixed expectation here was really asserting "no other test ran first" —
    // which failed as soon as one did. Its range is what matters.
    expect(inputs.realisedSalesVelocity).toBeGreaterThanOrEqual(0);
    expect(inputs.realisedSalesVelocity).toBeLessThanOrEqual(1);

    const current = await tokenRate.current();
    expect(current?.rate_paise).not.toBeNull();
  });

  it("closes out the previous rate's effective_to when publishing a new one", async () => {
    const first = await tokenRate.current();
    await tokenRate.computeAndPublish();

    const { rows } = await pool.query(
      `SELECT effective_to FROM token_rate WHERE computed_at = $1`,
      [first?.computed_at]
    );
    expect(rows[0]?.effective_to).not.toBeNull();
  });
});
