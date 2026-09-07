// The wizard reuses every existing admin endpoint — no new backend surface.
// Re-exported (not duplicated) from the pages that already wrap them.
export { createZone, type CreateZonePayload } from "../zones/core-api";
export {
  connectIntelligenceSource,
  syncIntelligenceSource,
  refreshZoneUnderstanding,
  getZoneUnderstanding,
  type ZoneUnderstandingStatus,
} from "../topics/core-api";
export { listSources, type IntelligenceSource } from "../intelligence/core-api";
export { resolveCategory, createQuestion, type CreateQuestionPayload, type AnswerType } from "../questions/core-api";
export { createTopic, generateNow, type CreateTopicPayload, type GeneratorKind } from "../topics/core-api";
export { listDraftQuestions, reviewQuestion, type DraftQuestion } from "../review/core-api";

export interface GenerateNowResult {
  runId: number;
  status: string;
  questionsGenerated: number;
}
