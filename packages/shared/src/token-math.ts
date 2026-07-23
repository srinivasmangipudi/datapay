import { z } from "zod";

/**
 * LAW 2 pricing (§6C): rate ∝ demand_pressure × realised_sales_velocity × supplier_competition.
 * Each factor is normalised to [0, 1] by the caller before this runs; this function only
 * combines them and applies bounds, so the formula can be tuned/back-tested in isolation.
 */
export const TokenRateInputsSchema = z.object({
  demandPressure: z.number().min(0).max(1),
  realisedSalesVelocity: z.number().min(0).max(1),
  supplierCompetition: z.number().min(0).max(1),
});
export type TokenRateInputs = z.infer<typeof TokenRateInputsSchema>;

export const TOKEN_RATE_FLOOR_PAISE = 50;
export const TOKEN_RATE_CEILING_PAISE = 500;

export function computeTokenRate(inputs: TokenRateInputs): number {
  const { demandPressure, realisedSalesVelocity, supplierCompetition } =
    TokenRateInputsSchema.parse(inputs);

  const combined = demandPressure * realisedSalesVelocity * supplierCompetition;
  const spanPaise = TOKEN_RATE_CEILING_PAISE - TOKEN_RATE_FLOOR_PAISE;
  const ratePaise = TOKEN_RATE_FLOOR_PAISE + combined * spanPaise;

  return Math.round(ratePaise);
}

export const TokenLedgerEntrySchema = z.enum([
  "earn_response",
  "earn_snap",
  "earn_voice",
  "earn_intent",
  "earn_bonus",
  "redeem_offer",
  "expire",
  "adjustment",
]);
export type TokenLedgerEntry = z.infer<typeof TokenLedgerEntrySchema>;
