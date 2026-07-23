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

/**
 * Core POST /v1/me/delivery-address, proxied to Vault's internal
 * /delivery-address (SPEC.md §7) — needed so the relay flow has an address
 * to resolve. Not one of §5A's original four endpoints; documented in §16.
 */
export const SetDeliveryAddressDtoSchema = z.object({
  address: z.string().min(4).max(500),
  zoneHint: z.string().max(120).optional(),
});
export type SetDeliveryAddressDto = z.infer<typeof SetDeliveryAddressDtoSchema>;

/** Vault-internal POST /delivery-address — Core supplies aliasId, never a user_id. */
export const VaultSetDeliveryAddressDtoSchema = SetDeliveryAddressDtoSchema.extend({
  aliasId: z.string().length(64),
});
export type VaultSetDeliveryAddressDto = z.infer<typeof VaultSetDeliveryAddressDtoSchema>;

/** Vault-internal POST /relay-map — registers a relay_token → address mapping at offer-join time. */
export const VaultRegisterRelayMapDtoSchema = z.object({
  aliasId: z.string().length(64),
  relayToken: z.string().uuid(),
  offerRef: z.string().min(1),
  expiresAt: z.string().datetime(),
});
export type VaultRegisterRelayMapDto = z.infer<typeof VaultRegisterRelayMapDtoSchema>;

/** Vault-internal POST /resolve-relay — the PACS node's only window into Vault. */
export const VaultResolveRelayDtoSchema = z.object({
  relayToken: z.string().uuid(),
});
export type VaultResolveRelayDto = z.infer<typeof VaultResolveRelayDtoSchema>;

/**
 * POST /v1/offers/:id/join — LAW 2's redemption gate lives behind
 * tokensToRedeem: omit or 0 to just join without redeeming.
 */
export const JoinOfferDtoSchema = z.object({
  qty: z.number().int().positive().default(1),
  tokensToRedeem: z.number().int().min(0).default(0),
});
export type JoinOfferDto = z.infer<typeof JoinOfferDtoSchema>;

/** Node operator app POST /v1/relay/resolve — proxied straight through to Vault. */
export const ResolveRelayRequestDtoSchema = z.object({
  relayToken: z.string().uuid(),
});
export type ResolveRelayRequestDto = z.infer<typeof ResolveRelayRequestDtoSchema>;

/** POST /v1/fund/projects/:id/vote — 1 member, 1 vote (SPEC.md §12 Phase 5). */
export const FundVoteDtoSchema = z.object({
  vote: z.enum(["yes", "no"]),
});
export type FundVoteDto = z.infer<typeof FundVoteDtoSchema>;

/** POST /v1/admin/fund-projects — ops proposes a project for a zone's fund. */
export const CreateFundProjectDtoSchema = z.object({
  zoneId: z.string().uuid(),
  title: z.string().min(1).max(200),
  titleKn: z.string().max(200).optional(),
  estimatePaise: z.number().int().positive(),
});
export type CreateFundProjectDto = z.infer<typeof CreateFundProjectDtoSchema>;
