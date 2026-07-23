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

  it("computes and publishes a rate with realisedSalesVelocity/supplierCompetition honestly at 0 (no offers exist until Phase 4)", async () => {
    const { ratePaise, inputs } = await tokenRate.computeAndPublish();

    expect(inputs.realisedSalesVelocity).toBe(0);
    expect(inputs.supplierCompetition).toBe(0);
    // With two factors at 0, the multiplicative formula floors the rate — this
    // is the correct value given no sales have happened yet, not a bug.
    expect(ratePaise).toBe(TOKEN_RATE_FLOOR_PAISE);

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
