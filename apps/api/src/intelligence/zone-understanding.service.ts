import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { z } from "zod";
import { PG_POOL } from "../db/db.module";
import { stripCodeFences } from "./llm-json.util";
import { AnthropicLlmProvider, LlmProvider } from "./llm.provider";

const KnowledgeMapSchema = z.object({
  economicActivities: z.array(z.string()).default([]),
  commonProductsAndBrands: z.array(z.string()).default([]),
  seasonalPatterns: z.array(z.string()).default([]),
  notableConcerns: z.array(z.string()).default([]),
  demandSignals: z.array(z.string()).default([]),
});

const UnderstandingResponseSchema = z.object({
  summaryEn: z.string().min(1),
  summaryKn: z.string().optional(),
  knowledgeMap: KnowledgeMapSchema,
});

export interface ZoneUnderstanding {
  id: number;
  summaryEn: string;
  summaryKn: string | null;
  knowledgeMap: z.infer<typeof KnowledgeMapSchema>;
  sourceDocumentIds: number[];
  modelUsed: string;
  generatedAt: Date;
}

function buildPrompt(docs: { title: string; content_text: string }[]): string {
  const corpus = docs
    .map((d, i) => `--- Document ${i + 1}: ${d.title} ---\n${d.content_text.slice(0, 8000)}`)
    .join("\n\n");

  return `You are building a factual understanding of a specific local area for a community
demand-aggregation platform, based ONLY on the documents below — do not invent facts not
supported by them.

${corpus}

Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this shape:
{
  "summaryEn": "a 3-5 sentence plain-English summary of what these documents reveal about this area",
  "summaryKn": "the same summary in Kannada",
  "knowledgeMap": {
    "economicActivities": ["short phrases, e.g. 'sugarcane farming', 'dairy cooperative'"],
    "commonProductsAndBrands": ["specific products or brands the documents mention"],
    "seasonalPatterns": ["e.g. 'harvest season Oct-Dec increases cash liquidity'"],
    "notableConcerns": ["real concerns mentioned in the documents — never health, religion, caste, or political opinions, even if mentioned"],
    "demandSignals": ["specific hints about what households might want to buy or need"]
  }
}
If a field has no supporting evidence in the documents, return an empty array for it rather than guessing.`;
}

// Builds a per-zone "understanding" — a narrative summary + structured
// knowledge map — from whatever documents have been ingested for that zone
// so far (SPEC.md §20). A new refresh is a new row, not an overwrite: how
// the read on an area changed over time stays visible.
@Injectable()
export class ZoneUnderstandingService {
  private llmInstance: LlmProvider | null = null;
  // Test-only seam — lets integration tests inject a fake provider instead
  // of requiring real Anthropic credentials in CI/dev. Never set in prod.
  llmOverride: LlmProvider | null = null;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // Lazy on purpose — constructing AnthropicLlmProvider throws if
  // ANTHROPIC_API_KEY is missing, and this feature is optional; the app
  // must still boot cleanly for anyone not using it. Config errors are
  // re-thrown as BadRequestException so ops sees the real reason in the
  // portal, not NestJS's generic 500 for an unrecognized Error.
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

  async refresh(zoneId: string): Promise<ZoneUnderstanding> {
    const { rows: docs } = await this.pool.query<{
      id: number;
      title: string;
      content_text: string;
    }>(
      `SELECT d.id, d.title, d.content_text
       FROM intelligence_documents d
       JOIN intelligence_sources s ON s.id = d.source_id
       WHERE s.zone_id = $1 AND d.content_text IS NOT NULL
       ORDER BY d.fetched_at DESC`,
      [zoneId]
    );
    if (docs.length === 0) {
      throw new BadRequestException(
        "No ingested documents for this zone yet — sync an intelligence source first"
      );
    }

    const raw = await this.llm.complete(buildPrompt(docs), { maxTokens: 4096 });
    const parsed = UnderstandingResponseSchema.parse(JSON.parse(stripCodeFences(raw)));

    const modelUsed = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
    const { rows } = await this.pool.query<{ id: number; generated_at: Date }>(
      `INSERT INTO zone_understanding
         (zone_id, summary_en, summary_kn, knowledge_map, source_document_ids, model_used)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, generated_at`,
      [
        zoneId,
        parsed.summaryEn,
        parsed.summaryKn ?? null,
        JSON.stringify(parsed.knowledgeMap),
        docs.map((d) => d.id),
        modelUsed,
      ]
    );

    return {
      id: rows[0].id,
      summaryEn: parsed.summaryEn,
      summaryKn: parsed.summaryKn ?? null,
      knowledgeMap: parsed.knowledgeMap,
      sourceDocumentIds: docs.map((d) => d.id),
      modelUsed,
      generatedAt: rows[0].generated_at,
    };
  }

  async getLatest(zoneId: string): Promise<ZoneUnderstanding | null> {
    const { rows } = await this.pool.query<{
      id: number;
      summary_en: string;
      summary_kn: string | null;
      knowledge_map: z.infer<typeof KnowledgeMapSchema>;
      source_document_ids: number[];
      model_used: string;
      generated_at: Date;
    }>(
      `SELECT id, summary_en, summary_kn, knowledge_map, source_document_ids, model_used, generated_at
       FROM zone_understanding WHERE zone_id = $1 ORDER BY generated_at DESC LIMIT 1`,
      [zoneId]
    );
    if (!rows[0]) return null;
    return {
      id: rows[0].id,
      summaryEn: rows[0].summary_en,
      summaryKn: rows[0].summary_kn,
      knowledgeMap: rows[0].knowledge_map,
      sourceDocumentIds: rows[0].source_document_ids,
      modelUsed: rows[0].model_used,
      generatedAt: rows[0].generated_at,
    };
  }
}
