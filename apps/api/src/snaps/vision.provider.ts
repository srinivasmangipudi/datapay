import { GoogleGenerativeAI } from "@google/generative-ai";
import { stripCodeFences } from "../intelligence/llm-json.util";

export interface CategoryOption {
  slug: string;
  name: string;
}

export interface SnapRecognition {
  tags: string[];
  label: string;
  confidence: number;
  productGuess: string | null;
  categorySlug: string | null;
}

export interface VisionProvider {
  analyze(imageBase64: string, categories: CategoryOption[], mimeType?: string): Promise<SnapRecognition>;
}

/**
 * DEV ONLY — no real vision client is wired up yet. Returns no tags at all
 * rather than inventing plausible-looking ones. "AI-tagged" is not a real
 * claim until this is swapped for a real provider.
 */
export class DevNoopVisionProvider implements VisionProvider {
  async analyze(): Promise<SnapRecognition> {
    return { tags: [], label: "", confidence: 0, productGuess: null, categorySlug: null };
  }
}

// Same rolling-alias reasoning as asr.provider.ts/translation.service.ts —
// pinned model names get deprecated for new keys even while still listed.
const DEFAULT_MODEL = "gemini-flash-latest";

// The real thing — Gemini's native vision understanding tags what's actually
// in the photo (product, packaging, setting) in the same call that would
// otherwise need a separate GCP Vision API integration. Fails loudly, not
// silently, if the key is missing (same posture as every other Gemini
// provider in this codebase).
export class GeminiVisionProvider implements VisionProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY — required for snap image recognition (SPEC.md §32)");
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  }

  async analyze(
    imageBase64: string,
    categories: CategoryOption[],
    mimeType = "image/jpeg"
  ): Promise<SnapRecognition> {
    const model = this.client.getGenerativeModel({ model: this.model });
    const categoryList = categories.map((c) => c.slug).join(", ");
    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType } },
      {
        text: `This photo is evidence a rural household submitted for a small reward — usually a
grocery or household product they use, sometimes its packaging, a receipt, or a shop shelf. Look
at what's actually in the frame and describe it.

Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this shape:
{"tags": ["short", "lowercase", "descriptive", "tags"], "label": "one short phrase naming the main subject", "productGuess": "brand + product name if you can make one out, else null", "categorySlug": "one of [${categoryList}] if the photo clearly fits one, else null", "confidence": 0.0 to 1.0}

"tags" should be 3-8 concrete, specific words (e.g. product type, brand if legible, packaging,
setting) — not vague ones like "photo" or "image". "productGuess" should be null rather than a
guess if no product name or brand is actually legible — do not invent one. "categorySlug" MUST be
exactly one of the listed slugs (copy it verbatim) or null — never a category not in that list.
"confidence" is your own honest confidence that the photo actually shows real purchase/usage
evidence rather than something irrelevant or unclear.`,
      },
    ]);

    const raw = result.response.text();
    let parsed: {
      tags?: unknown;
      label?: unknown;
      confidence?: unknown;
      productGuess?: unknown;
      categorySlug?: unknown;
    };
    try {
      parsed = JSON.parse(stripCodeFences(raw));
    } catch (err) {
      throw new Error(`Couldn't parse Gemini's vision response as JSON: ${(err as Error).message}`);
    }

    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === "string").slice(0, 8)
      : [];
    const label = typeof parsed.label === "string" ? parsed.label : "";
    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0;
    const productGuess = typeof parsed.productGuess === "string" ? parsed.productGuess : null;
    // Never trust the slug blindly — a hallucinated one must not become a
    // dangling reference; only one that's genuinely in the list we sent survives.
    const categorySlug =
      typeof parsed.categorySlug === "string" && categories.some((c) => c.slug === parsed.categorySlug)
        ? parsed.categorySlug
        : null;
    return { tags, label, confidence, productGuess, categorySlug };
  }
}
