import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { z } from "zod";
import { PG_POOL } from "../db/db.module";
import { QuestionVariantSchema } from "../question-feeder/question-variant.schema";
import { stripCodeFences } from "./llm-json.util";
import { AnthropicLlmProvider, LlmProvider } from "./llm.provider";
import { ZoneUnderstanding, ZoneUnderstandingService } from "./zone-understanding.service";

const DocumentGroundedConfigSchema = z.object({
  questionCount: z.number().int().min(1).max(10).default(3),
  focusAreas: z.array(z.string()).optional(),
  toneNote: z.string().optional(),
});

function buildQuestionPrompt(
  understanding: ZoneUnderstanding,
  categoryName: string,
  config: z.infer<typeof DocumentGroundedConfigSchema>
): string {
  return `You are drafting daily survey questions for members of a rural/semi-urban Indian
demand-aggregation platform, in the category "${categoryName}".

Here is what's known about this specific area, derived from locally ingested documents:
Summary: ${understanding.summaryEn}
Knowledge map: ${JSON.stringify(understanding.knowledgeMap, null, 2)}
${config.focusAreas?.length ? `Focus especially on: ${config.focusAreas.join(", ")}` : ""}
${config.toneNote ? `Tone: ${config.toneNote}` : ""}

Generate exactly ${config.questionCount} candidate questions grounded in the specific local
context above — not generic questions that could apply anywhere. Prefer a question answerable
with a single tap or a short number; only use "free_text" for something that genuinely needs
the member's own words (an opinion, a description, a reason) and can't be reduced to a few
tap options without losing what matters.

Rules (non-negotiable):
- Never ask about health, religion, caste, precise location/address, or political opinion —
  even if the source documents mention them.
- Each question needs a clear, short "type": one of "single", "multi", "yesno",
  "intent_window", "numeric", "free_text". If "single"/"multi"/"yesno", include 2-5 short tap
  options. "numeric" and "free_text" need no options at all.
- rewardTokens should be a small integer (3-6).

Respond with ONLY a JSON array (no markdown fences, no commentary) matching exactly this shape:
[
  {
    "textEn": "...", "textKn": "... (Kannada translation)",
    "type": "single",
    "rewardTokens": 4,
    "options": [{"labelEn": "...", "labelKn": "..."}]
  }
]`;
}

// Turns a zone's understanding into candidate questions — but the output is
// still just DRAFTS. It goes through QuestionFeederService the same way a
// 'template' topic's variants do, landing in the same review queue before
// any member ever sees it (SPEC.md §14/§20D — nothing here bypasses review).
@Injectable()
export class DocumentGroundedGeneratorService {
  private llmInstance: LlmProvider | null = null;
  llmOverride: LlmProvider | null = null;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly understanding: ZoneUnderstandingService
  ) {}

  private get llm(): LlmProvider {
    if (this.llmOverride) return this.llmOverride;
    if (!this.llmInstance) {
      try {
        this.llmInstance = new AnthropicLlmProvider();
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
    }
    return this.llmInstance;
  }

  async generateVariants(topic: {
    zoneId: string | null;
    categoryId: number;
    config: unknown;
  }): Promise<z.infer<typeof QuestionVariantSchema>[]> {
    if (!topic.zoneId) {
      throw new BadRequestException("document_grounded topics require a zone_id");
    }

    const zoneUnderstanding = await this.understanding.getLatest(topic.zoneId);
    if (!zoneUnderstanding) {
      throw new BadRequestException(
        "No zone understanding yet for this topic's zone — refresh it first"
      );
    }

    const { rows: catRows } = await this.pool.query<{ name: string }>(
      `SELECT name FROM categories WHERE id = $1`,
      [topic.categoryId]
    );
    if (!catRows[0]) throw new BadRequestException(`Category ${topic.categoryId} not found`);

    const config = DocumentGroundedConfigSchema.parse(topic.config);
    const prompt = buildQuestionPrompt(zoneUnderstanding, catRows[0].name, config);
    const raw = await this.llm.complete(prompt, { maxTokens: 2048 });
    return z.array(QuestionVariantSchema).parse(JSON.parse(stripCodeFences(raw)));
  }
}
