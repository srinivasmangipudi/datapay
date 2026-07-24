import { z } from "zod";

// One draft question's shape — shared between the 'template' generator
// (author writes these by hand in topic.config) and the 'document_grounded'
// generator (the LLM's JSON output is validated against this exact schema,
// SPEC.md §20D — malformed model output fails the run loudly rather than
// silently corrupting `questions`). Lives in its own file, not
// question-feeder.service.ts, specifically to avoid a circular import: the
// intelligence module's generator needs this schema, and question-feeder
// needs the generator — both importing from a third, dependency-free file
// breaks the cycle.
export const QuestionVariantSchema = z.object({
  textEn: z.string().min(1),
  textKn: z.string().optional(),
  type: z.enum(["single", "multi", "yesno", "intent_window", "numeric", "free_text"]),
  rewardTokens: z.number().int().positive().default(4),
  options: z
    .array(z.object({ labelEn: z.string().min(1), labelKn: z.string().optional() }))
    .optional(),
});
