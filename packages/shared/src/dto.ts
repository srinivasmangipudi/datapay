import { z } from "zod";
import { INPUT_MODES, ZONE_LEVELS } from "./constants";

/**
 * POST /v1/pulse/answers — idempotent by clientMsgId (offline outbox).
 * `textValue`/`photoBase64` are supplementary evidence available on every
 * question regardless of type — additive to, never a replacement for, the
 * question's own required structured answer (optionIds/numericValue).
 */
export const PulseAnswerDtoSchema = z.object({
  clientMsgId: z.string().uuid(),
  questionId: z.number().int().positive(),
  optionIds: z.array(z.number().int().positive()).optional(),
  numericValue: z.number().optional(),
  textValue: z.string().min(1).max(2000).optional(),
  photoBase64: z.string().min(1).optional(),
  inputMode: z.enum(INPUT_MODES).default("tap"),
  language: z.string().min(2).max(10),
  answeredAt: z.string().datetime(),
  // SPEC.md §35 — used transiently, server-side, to resolve the nearest zone
  // at answer time; never persisted as raw coordinates anywhere (LAW 1).
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type PulseAnswerDto = z.infer<typeof PulseAnswerDtoSchema>;

/** POST /v1/pulse/answers — batch envelope; the offline outbox flushes many at once. */
export const PulseAnswersBatchDtoSchema = z.object({
  answers: z.array(PulseAnswerDtoSchema).min(1).max(20),
  // Raw device fingerprint, hashed server-side before storage (SPEC.md §6
  // fraud engine, §19A). Optional — older mobile builds won't send one yet.
  deviceFingerprint: z.string().min(8).max(256).optional(),
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
  generatorKind: z.enum(["template", "llm_assisted", "document_grounded"]),
  config: z.record(z.unknown()),
  scheduleCron: z.string().optional(),
  // Required for 'document_grounded' topics (validated at generation time,
  // not here — the same free-form-config pattern 'template' already uses).
  zoneId: z.string().uuid().optional(),
});
export type QuestionTopicDto = z.infer<typeof QuestionTopicDtoSchema>;

const QuestionOptionInputSchema = z.object({
  labelEn: z.string().min(1).max(120),
  labelKn: z.string().max(120).optional(),
});

/**
 * POST /v1/admin/questions — an admin authors one question directly (no
 * generator topic involved). Cross-field rules enforced here, not left to
 * the database: single/multi/yesno need ≥2 options; intent_window needs a
 * window. The admin typing this in IS the review (SPEC.md §14), so it's
 * created straight into review_state='approved' — never 'draft'.
 */
export const CreateQuestionDtoSchema = z
  .object({
    categoryId: z.number().int().positive(),
    textEn: z.string().min(1).max(300),
    // SPEC.md §39 — replaces the old fixed textKn field. Any number of
    // language translations, each independently optional; a question with
    // none is still fully valid (shows English only until translated).
    translations: z
      .array(z.object({ languageCode: z.string().min(2).max(5), text: z.string().min(1).max(300) }))
      .optional(),
    type: z.enum(["single", "multi", "yesno", "intent_window", "numeric", "free_text"]),
    // TOKEN_ECONOMY_REDESIGN.md — default is 1, not a tuned-per-question-type
    // amount; still overridable per question (e.g. a photo question worth
    // more effort can still be set higher).
    rewardTokens: z.number().int().positive().default(1),
    options: z.array(QuestionOptionInputSchema).optional(),
    intentWindow: z.enum(["1m", "3m", "6m", "12m"]).optional(),
    // Omit for a global question (every member sees it). Set to scope it to
    // a zone and every zone beneath it in the hierarchy — never sideways to
    // a sibling zone (SPEC.md §23).
    zoneId: z.string().uuid().optional(),
    // Whether photo/voice can be attached as evidence on THIS question
    // (SPEC.md §34) — both on by default; the question's author opts out,
    // not in.
    allowPhoto: z.boolean().default(true),
    allowVoice: z.boolean().default(true),
  })
  .superRefine((val, ctx) => {
    if (["single", "multi", "yesno"].includes(val.type) && (val.options?.length ?? 0) < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: `type '${val.type}' needs at least 2 options`,
      });
    }
    if (val.type === "intent_window" && !val.intentWindow) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["intentWindow"],
        message: "type 'intent_window' requires an intentWindow",
      });
    }
  });
export type CreateQuestionDto = z.infer<typeof CreateQuestionDtoSchema>;

/**
 * POST /v1/admin/categories (SPEC.md §25/§26). Find-or-create by slug, not a
 * strict insert — an admin typing a brand-new category name inline (e.g. in
 * the question wizard) shouldn't need to visit a separate screen first, and
 * retrying the same name twice must never fail on a duplicate-slug error.
 * `slug` is optional and derived from `name` when omitted.
 */
export const CreateCategoryDtoSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(60).optional(),
  nameKn: z.string().max(120).optional(),
  // §2: no health/religion/caste/political categories — 'none' means "no
  // sensitivity concerns," there is no sensitive tier by design.
  sensitivity: z.enum(["standard", "none"]).default("standard"),
});
export type CreateCategoryDto = z.infer<typeof CreateCategoryDtoSchema>;

/** POST /v1/admin/zones (SPEC.md §25). */
export const CreateZoneDtoSchema = z.object({
  name: z.string().min(1).max(120),
  nameKn: z.string().max(120).optional(),
  level: z.enum(ZONE_LEVELS),
  parentId: z.string().uuid().optional(),
  // A representative point for this zone (e.g. its town center) — used only
  // to resolve a member's GPS reading to the nearest zone (SPEC.md §35), not
  // a real boundary. Optional: a zone with no centroid is simply never
  // matched, not an error.
  centroidLat: z.number().min(-90).max(90).optional(),
  centroidLng: z.number().min(-180).max(180).optional(),
  // SPEC.md §39 — a manually-created zone has no geocoded state data to
  // derive this from automatically, so the admin sets it directly.
  languageCode: z.string().min(2).max(5).optional(),
});
export type CreateZoneDto = z.infer<typeof CreateZoneDtoSchema>;

/** PATCH /v1/admin/zones/:id — set or correct a zone's centroid after creation. */
export const UpdateZoneCentroidDtoSchema = z.object({
  centroidLat: z.number().min(-90).max(90),
  centroidLng: z.number().min(-180).max(180),
});
export type UpdateZoneCentroidDto = z.infer<typeof UpdateZoneCentroidDtoSchema>;

/** PATCH /v1/admin/zones/:id/language — set or correct a zone's local language. */
export const UpdateZoneLanguageDtoSchema = z.object({
  languageCode: z.string().min(2).max(5),
});
export type UpdateZoneLanguageDto = z.infer<typeof UpdateZoneLanguageDtoSchema>;

/**
 * POST /v1/admin/translate (SPEC.md §27) — a starting draft, never the
 * system of record; the admin edits before anything is saved.
 */
export const TranslateDtoSchema = z.object({
  text: z.string().min(1).max(500),
  // SPEC.md §39 — any of the platform's supported languages, not just
  // Kannada; the actual supported set is validated server-side
  // (TranslationService), not enumerated here.
  targetLang: z.string().min(2).max(5).default("hi"),
});
export type TranslateDto = z.infer<typeof TranslateDtoSchema>;

/** POST /v1/admin/intelligence-sources — connects a Drive folder to a zone (SPEC.md §20). */
export const ConnectIntelligenceSourceDtoSchema = z.object({
  zoneId: z.string().uuid(),
  externalRef: z.string().min(1), // Drive folder ID
  displayName: z.string().min(1).max(120),
});
export type ConnectIntelligenceSourceDto = z.infer<typeof ConnectIntelligenceSourceDtoSchema>;

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

/**
 * Vault POST /alias-candidates — SPEC.md §36 "see various combinations":
 * a fresh batch of display-alias options for the same pending signup session.
 */
export const AliasCandidatesDtoSchema = z.object({
  pendingToken: z.string().uuid(),
});
export type AliasCandidatesDto = z.infer<typeof AliasCandidatesDtoSchema>;

/** Vault POST /commit-alias — locks in the member's chosen display alias (SPEC.md §36). */
export const CommitAliasDtoSchema = z.object({
  pendingToken: z.string().uuid(),
  displayAlias: z.string().min(1).max(60),
});
export type CommitAliasDto = z.infer<typeof CommitAliasDtoSchema>;

/** Core PUT /v1/me — completes onboarding once an alias exists. Never carries a phone. */
export const CompleteOnboardingDtoSchema = z.object({
  zoneId: z.string().uuid(),
  householdSizeBand: z.string().optional(),
  locale: z.string().min(2).max(10).default("kn"),
  // SPEC.md §38 — false when zoneId is a nearest-match fallback (the
  // member's real area isn't in the zones tree yet), not a real pick.
  zoneConfirmed: z.boolean().default(true),
  requestedAreaNote: z.string().max(300).optional(),
});
export type CompleteOnboardingDto = z.infer<typeof CompleteOnboardingDtoSchema>;

/**
 * Core POST /v1/zones/resolve-location — SPEC.md §38 onboarding fallback:
 * "detect my location" (lat/lng) or "enter my address" (address), either
 * way resolved to a real place, matched to an existing zone or created new.
 */
export const ResolveLocationDtoSchema = z.union([
  z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  z.object({ address: z.string().min(3).max(300) }),
]);
export type ResolveLocationDto = z.infer<typeof ResolveLocationDtoSchema>;

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

/**
 * POST /v1/fund/projects — a member proposes a project, member-facing (SPEC.md
 * §30). No zoneId field: unlike the admin variant, the zone is always the
 * caller's own (resolved server-side from their alias), never client-supplied.
 */
export const ProposeFundProjectDtoSchema = z.object({
  title: z.string().min(1).max(200),
  titleKn: z.string().max(200).optional(),
  estimatePaise: z.number().int().positive(),
});
export type ProposeFundProjectDto = z.infer<typeof ProposeFundProjectDtoSchema>;

/**
 * PATCH /v1/admin/fund-projects/:id — ops edits a project's details or
 * advances it through its status lifecycle (proposed → voting → approved →
 * funded → done). Every field optional; at least one must be present.
 */
export const UpdateFundProjectDtoSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    titleKn: z.string().max(200).optional(),
    estimatePaise: z.number().int().positive().optional(),
    status: z.enum(["proposed", "voting", "approved", "funded", "done"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });
export type UpdateFundProjectDto = z.infer<typeof UpdateFundProjectDtoSchema>;

/** Core POST /v1/produce/payout-instrument, proxied to Vault's internal /payout-instrument. */
export const SetPayoutInstrumentDtoSchema = z.object({
  upiId: z.string().min(3).max(120),
});
export type SetPayoutInstrumentDto = z.infer<typeof SetPayoutInstrumentDtoSchema>;

/** Vault-internal POST /payout-instrument — Core supplies aliasId, never a user_id. */
export const VaultSetPayoutInstrumentDtoSchema = SetPayoutInstrumentDtoSchema.extend({
  aliasId: z.string().length(64),
});
export type VaultSetPayoutInstrumentDto = z.infer<typeof VaultSetPayoutInstrumentDtoSchema>;

/** Vault-internal POST /resolve-payout — batch, producers only (SPEC.md §5A). */
export const VaultResolvePayoutDtoSchema = z.object({
  aliasIds: z.array(z.string().length(64)).min(1).max(500),
});
export type VaultResolvePayoutDto = z.infer<typeof VaultResolvePayoutDtoSchema>;

/** Producer registration + listing (SPEC.md §12 Phase 6). */
export const ProducerProfileDtoSchema = z.object({
  kind: z.enum(["farmer", "shg", "artisan", "micro_unit"]),
  shgId: z.number().int().positive().optional(),
  capacityNote: z.string().max(500).optional(),
});
export type ProducerProfileDto = z.infer<typeof ProducerProfileDtoSchema>;

export const ProduceListingDtoSchema = z.object({
  produceCategoryId: z.number().int().positive(),
  qty: z.number().positive(),
  unit: z.enum(["kg", "quintal", "litre", "piece", "acre_yield"]),
  qualityNote: z.string().max(300).optional(),
  readyAt: z.string().datetime().optional(),
  inputMode: z.enum(["tap", "voice", "snap"]).default("tap"),
  snapIds: z.array(z.number().int().positive()).optional(),
  askingPricePaise: z.number().int().positive().optional(),
});
export type ProduceListingDto = z.infer<typeof ProduceListingDtoSchema>;

/** POST /v1/linkages/:id/advance — progressive identity disclosure (SPEC.md §8 screen 5). */
export const AdvanceLinkageDtoSchema = z.object({
  toState: z.enum(["producer_interested", "negotiating", "agreed", "completed", "declined"]),
});
export type AdvanceLinkageDto = z.infer<typeof AdvanceLinkageDtoSchema>;
