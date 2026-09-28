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

/**
 * Platform-wide defaults for the two purchase-time rates, in basis points
 * (200 = 2.00%). A product may override either; NULL on the product means
 * "use these", so changing a default here moves every product that never set
 * one of its own.
 *
 * DELIBERATELY a flat percentage of spend, not a value-derived rate. A formula
 * like `price ÷ (system value ÷ outstanding tokens)` would make a token a
 * claim on accumulated value — the security framing DataPay's copy is careful
 * to avoid — and has no damping: more outstanding tokens would mean larger
 * awards, which mean more outstanding tokens. A flat rate says only "you spent
 * X, you earned Y" and makes no claim about what a token is worth.
 */
export const DEFAULT_TOKEN_REWARD_BPS = 200;
export const DEFAULT_PLATFORM_FEE_BPS = 200;

/** Tokens earned on a purchase: bps of spend, expressed in whole rupees. */
export function purchaseTokenReward(amountPaise: number, bps: number | null | undefined): number {
  const rate = bps ?? DEFAULT_TOKEN_REWARD_BPS;
  return Math.round((amountPaise * rate) / 10000 / 100);
}

/** The supplier's fee on a sale, in paise, that builds the reward pool. */
export function platformFeePaise(amountPaise: number, bps: number | null | undefined): number {
  const rate = bps ?? DEFAULT_PLATFORM_FEE_BPS;
  return Math.round((amountPaise * rate) / 10000);
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
