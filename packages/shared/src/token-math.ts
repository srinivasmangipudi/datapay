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
 * Tokens earned for buying through the platform: a FLAT count per order, the
 * same scale as answering a question — not a share of what was spent.
 *
 * This is the single most important line in the token design. A reward
 * proportional to spend means money in gets tokens out, and tokens set a share
 * of the reward pool — which is an investment return however the copy words
 * it. A flat count rewards the act of participating: buying through DataPay is
 * a real contribution to the platform and should earn something, but spending
 * ₹10,000 must not earn ten times what ₹1,000 earns.
 *
 * Also rejected: `price ÷ (system value ÷ outstanding tokens)`. That makes a
 * token an explicit claim on accumulated value, and has no damping — more
 * outstanding tokens would mean larger awards, which mean more outstanding
 * tokens.
 */
export const DEFAULT_PURCHASE_REWARD_TOKENS = 1;

/**
 * The supplier's fee stays a PERCENTAGE, and that's correct: it is ordinary
 * B2B revenue DataPay charges on a sale, not a member reward, so none of the
 * reasoning above applies to it.
 */
export const DEFAULT_PLATFORM_FEE_BPS = 200;

/** Tokens earned on one order. Quantity-independent by design: one order is
    one act of participation, whether it is one sack of rice or ten. */
export function purchaseTokenReward(perOrder: number | null | undefined): number {
  return perOrder ?? DEFAULT_PURCHASE_REWARD_TOKENS;
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
