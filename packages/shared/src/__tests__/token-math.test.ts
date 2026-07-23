import { describe, expect, it } from "vitest";
import {
  computeTokenRate,
  TOKEN_RATE_CEILING_PAISE,
  TOKEN_RATE_FLOOR_PAISE,
} from "../token-math";

describe("computeTokenRate", () => {
  it("returns the floor when all factors are zero", () => {
    expect(
      computeTokenRate({
        demandPressure: 0,
        realisedSalesVelocity: 0,
        supplierCompetition: 0,
      })
    ).toBe(TOKEN_RATE_FLOOR_PAISE);
  });

  it("returns the ceiling when all factors are saturated", () => {
    expect(
      computeTokenRate({
        demandPressure: 1,
        realisedSalesVelocity: 1,
        supplierCompetition: 1,
      })
    ).toBe(TOKEN_RATE_CEILING_PAISE);
  });

  it("rises monotonically as any single factor rises", () => {
    const low = computeTokenRate({
      demandPressure: 0.5,
      realisedSalesVelocity: 0.5,
      supplierCompetition: 0.5,
    });
    const high = computeTokenRate({
      demandPressure: 0.9,
      realisedSalesVelocity: 0.5,
      supplierCompetition: 0.5,
    });
    expect(high).toBeGreaterThan(low);
  });

  it("rejects out-of-range inputs", () => {
    expect(() =>
      computeTokenRate({
        demandPressure: 1.5,
        realisedSalesVelocity: 0.5,
        supplierCompetition: 0.5,
      })
    ).toThrow();
  });
});
