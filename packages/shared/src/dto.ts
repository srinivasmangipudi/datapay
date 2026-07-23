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

/** POST /v1/pulse/answers — batch envelope; the offline outbox flushes many at once. */
export const PulseAnswersBatchDtoSchema = z.object({
  answers: z.array(PulseAnswerDtoSchema).min(1).max(20),
});
export type PulseAnswersBatchDto = z.infer<typeof PulseAnswersBatchDtoSchema>;

/** POST /v1/snaps — idempotent by clientMsgId, same discipline as pulse answers. */
export const SnapDtoSchema = z.object({
  clientMsgId: z.string().uuid(),
  imageBase64: z.string().min(1),
  categoryId: z.number().int().positive().optional(),
  capturedAt: z.string().datetime(),
});
export type SnapDto = z.infer<typeof SnapDtoSchema>;

/** POST /v1/voice/transcribe — audio is transcribed and discarded, never persisted. */
export const VoiceTranscribeDtoSchema = z.object({
  audioBase64: z.string().min(1),
  language: z.string().min(2).max(10),
});
export type VoiceTranscribeDto = z.infer<typeof VoiceTranscribeDtoSchema>;

/** PUT /v1/vault/consents/:categoryId */
export const ConsentUpdateDtoSchema = z.object({
  granted: z.boolean(),
});
export type ConsentUpdateDto = z.infer<typeof ConsentUpdateDtoSchema>;

/** POST /v1/admin/question-topics — registers a Question Feeder Engine topic (SPEC.md §14). */
export const QuestionTopicDtoSchema = z.object({
  slug: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  categoryId: z.number().int().positive(),
  generatorKind: z.enum(["template", "llm_assisted"]),
  config: z.record(z.unknown()),
  scheduleCron: z.string().optional(),
});
export type QuestionTopicDto = z.infer<typeof QuestionTopicDtoSchema>;

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
