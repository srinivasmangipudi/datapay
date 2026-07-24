import { GoogleGenerativeAI } from "@google/generative-ai";
import { stripCodeFences } from "../intelligence/llm-json.util";

export interface AsrProvider {
  transcribe(
    audioBase64: string,
    language: string,
    mimeType?: string
  ): Promise<{ text: string; translatedText?: string }>;
}

/**
 * DEV ONLY — no real ASR client is wired up yet. Returns a canned, empty
 * transcript and does not perform any actual speech recognition. "Voice
 * input" is not a real claim until this is swapped for a real provider.
 */
export class DevNoopAsrProvider implements AsrProvider {
  async transcribe(): Promise<{ text: string; translatedText?: string }> {
    return { text: "" };
  }
}

// A rolling alias Google maintains to always point at their current
// recommended flash model — pinned version names (e.g. "gemini-2.5-flash")
// get deprecated for new API keys/projects even while still listed in the
// model catalog; confirmed by testing directly against this key.
const DEFAULT_MODEL = "gemini-flash-latest";

// The real thing — Bhashini was ruled out as too bureaucratic to integrate
// for the pilot; Gemini's native audio understanding does transcription and
// translation in the same call, so no separate GCP Speech-to-Text wiring is
// needed. Still fails loudly (not silently) if the key is missing.
export class GeminiAsrProvider implements AsrProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing GEMINI_API_KEY — required for voice transcription (SPEC.md §9)"
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  }

  async transcribe(
    audioBase64: string,
    language: string,
    mimeType = "audio/m4a"
  ): Promise<{ text: string; translatedText?: string }> {
    const model = this.client.getGenerativeModel({ model: this.model });
    const result = await model.generateContent([
      { inlineData: { data: audioBase64, mimeType } },
      {
        text: `Transcribe this audio exactly as spoken — the speaker's declared
language code is "${language}", but transcribe whatever language is actually
spoken. If the spoken language isn't English, also provide an English
translation; if it's already English, omit translatedText.

Respond with ONLY a JSON object (no markdown fences, no commentary) matching
exactly this shape:
{"transcript": "...", "translatedText": "... or omit this field entirely"}`,
      },
    ]);

    const raw = result.response.text();
    let parsed: { transcript?: string; translatedText?: string };
    try {
      parsed = JSON.parse(stripCodeFences(raw));
    } catch (err) {
      throw new Error(`Couldn't parse Gemini's transcription response as JSON: ${(err as Error).message}`);
    }
    return { text: parsed.transcript ?? "", translatedText: parsed.translatedText || undefined };
  }
}
