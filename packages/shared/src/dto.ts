import { z } from "zod";
import { INPUT_MODES } from "./constants";

/** POST /v1/pulse/answers — idempotent by clientMsgId (offline outbox). */
export const PulseAnswerDtoSchema = z.object({
  clientMsgId: z.string().uuid(),
  questionId: z.number().int().positive(),
  optionIds: z.array(z.number().int().positive()).optional(),
  numericValue: z.number().optional(),
  inputMode: z.enum(INPUT_MODES).default("tap"),
  language: z.string().min(2).max(10),
  answeredAt: z.string().datetime(),
});
export type PulseAnswerDto = z.infer<typeof PulseAnswerDtoSchema>;

/** Vault POST /register — phone + name never leave Vault. */
export const RegisterDtoSchema = z.object({
  phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  name: z.string().min(1).max(120),
});
export type RegisterDto = z.infer<typeof RegisterDtoSchema>;

/** Vault POST /verify-otp */
export const VerifyOtpDtoSchema = z.object({
  phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  otp: z.string().length(6),
});
export type VerifyOtpDto = z.infer<typeof VerifyOtpDtoSchema>;

/** Core PUT /v1/me — completes onboarding once an alias exists. Never carries a phone. */
export const CompleteOnboardingDtoSchema = z.object({
  zoneId: z.string().uuid(),
  householdSizeBand: z.string().optional(),
  locale: z.string().min(2).max(10).default("kn"),
});
export type CompleteOnboardingDto = z.infer<typeof CompleteOnboardingDtoSchema>;
