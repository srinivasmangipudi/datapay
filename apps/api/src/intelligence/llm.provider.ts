import Anthropic from "@anthropic-ai/sdk";
import { FinishReason, GoogleGenerativeAI } from "@google/generative-ai";

export interface LlmProvider {
  complete(prompt: string, opts?: { maxTokens?: number }): Promise<string>;
}

const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-5";

// Kept for anyone who sets ANTHROPIC_API_KEY and prefers it — not the
// default anymore (GeminiLlmProvider below is), since reusing the Gemini
// key already required for vision/translation/ASR means one fewer API key
// to provision. Still fails loudly rather than silently if the key is
// missing, same posture as every other required-secret check in this
// codebase (VAULT_SECRET_KEY, CORE_DATABASE_URL, etc.) — a missing key is a
// config error, not something to paper over with a fake response.
export class AnthropicLlmProvider implements LlmProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing ANTHROPIC_API_KEY — required for the document-grounded question engine (SPEC.md §20)"
      );
    }
    this.client = new Anthropic({ apiKey });
    this.model = process.env.ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL;
  }

  async complete(prompt: string, opts?: { maxTokens?: number }): Promise<string> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: opts?.maxTokens ?? 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = res.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    if (!textBlock) {
      throw new Error("Anthropic response contained no text block");
    }
    // A response cut off mid-output (e.g. a JSON reply truncated mid-string)
    // fails downstream with a confusing parse error rather than naming the
    // real cause — surface it here instead, per §11's "flag, don't fake".
    if (res.stop_reason === "max_tokens") {
      throw new Error(
        `Anthropic response was truncated at the ${opts?.maxTokens ?? 4096}-token limit before finishing`
      );
    }
    return textBlock.text;
  }
}

const GEMINI_DEFAULT_MODEL = "gemini-flash-latest";

// Default provider — same Gemini key already required for vision
// (SPEC.md §32), translation (§27/§39), and voice (§9), so this feature
// doesn't need its own separate API key/billing setup.
export class GeminiLlmProvider implements LlmProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing GEMINI_API_KEY — required for the document-grounded question engine (SPEC.md §20)"
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  }

  async complete(prompt: string, opts?: { maxTokens?: number }): Promise<string> {
    const maxOutputTokens = opts?.maxTokens ?? 4096;
    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: { maxOutputTokens },
    });
    const result = await model.generateContent([{ text: prompt }]);
    const candidate = result.response.candidates?.[0];
    if (!candidate) {
      throw new Error("Gemini response contained no candidate");
    }
    // Same "flag, don't fake" posture as AnthropicLlmProvider above — a
    // response cut off mid-output fails downstream with a confusing parse
    // error rather than naming the real cause.
    if (candidate.finishReason === FinishReason.MAX_TOKENS) {
      throw new Error(`Gemini response was truncated at the ${maxOutputTokens}-token limit before finishing`);
    }
    return result.response.text();
  }
}
