import { BadRequestException, Injectable } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";

// A rolling alias Google maintains to always point at their current
// recommended flash model — pinned version names (e.g. "gemini-2.5-flash")
// get deprecated for new API keys/projects even while still listed in the
// model catalog; confirmed by testing directly against this key.
const DEFAULT_MODEL = "gemini-flash-latest";

const LANGUAGE_NAMES: Record<string, string> = {
  kn: "Kannada",
};

export interface TranslationProvider {
  translate(text: string, targetLang: string): Promise<string>;
}

// Same posture as GeminiAsrProvider (apps/api/src/voice/asr.provider.ts) —
// fails loudly, not silently, if the key is missing.
class GeminiTranslationProvider implements TranslationProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY — required for question translation (SPEC.md §27)");
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  }

  async translate(text: string, targetLang: string): Promise<string> {
    const languageName = LANGUAGE_NAMES[targetLang];
    const model = this.client.getGenerativeModel({ model: this.model });
    const result = await model.generateContent([
      {
        text: `Translate the following text into ${languageName}. Respond with ONLY the
translation — no quotes, no commentary, no markdown.

Text: ${text}`,
      },
    ]);
    return result.response.text().trim();
  }
}

// A thin, editable-before-save auto-translate (SPEC.md §27) — never the
// system of record. The admin's edited text is what actually gets saved;
// this only ever fills in a starting draft.
@Injectable()
export class TranslationService {
  private providerInstance: TranslationProvider | null = null;
  translationOverride: TranslationProvider | null = null;

  private get provider(): TranslationProvider {
    if (this.translationOverride) return this.translationOverride;
    if (!this.providerInstance) {
      try {
        this.providerInstance = new GeminiTranslationProvider();
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
    }
    return this.providerInstance;
  }

  async translate(text: string, targetLang: string): Promise<{ translated: string }> {
    if (!LANGUAGE_NAMES[targetLang]) {
      throw new BadRequestException(
        `Unsupported targetLang '${targetLang}' — only ${Object.keys(LANGUAGE_NAMES).join(", ")} supported today`
      );
    }
    try {
      const translated = await this.provider.translate(text, targetLang);
      return { translated };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException((err as Error).message);
    }
  }
}
