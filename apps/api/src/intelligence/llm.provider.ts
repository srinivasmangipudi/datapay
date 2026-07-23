import Anthropic from "@anthropic-ai/sdk";

export interface LlmProvider {
  complete(prompt: string, opts?: { maxTokens?: number }): Promise<string>;
}

const DEFAULT_MODEL = "claude-sonnet-5";

// The real thing, not a stub — the user explicitly chose Anthropic. Still
// fails loudly rather than silently if the key is missing, same posture as
// every other required-secret check in this codebase (VAULT_SECRET_KEY,
// CORE_DATABASE_URL, etc.) — a missing key is a config error, not something
// to paper over with a fake response.
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
    this.model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
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
    return textBlock.text;
  }
}
