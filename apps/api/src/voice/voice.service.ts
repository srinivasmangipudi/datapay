import { BadRequestException, Injectable } from "@nestjs/common";
import type { VoiceTranscribeDto } from "@datapay/shared";
import { AsrProvider, GeminiAsrProvider } from "./asr.provider";

@Injectable()
export class VoiceService {
  private asrInstance: AsrProvider | null = null;
  // Test-only seam — same pattern as ZoneUnderstandingService.llmOverride.
  asrOverride: AsrProvider | null = null;

  // Lazy on purpose — constructing GeminiAsrProvider throws if GEMINI_API_KEY
  // is missing, and the app must still boot cleanly for anyone not using
  // voice yet. Config errors surface as BadRequestException so the client
  // sees the real reason, not NestJS's generic 500.
  private get asr(): AsrProvider {
    if (this.asrOverride) return this.asrOverride;
    if (!this.asrInstance) {
      try {
        this.asrInstance = new GeminiAsrProvider();
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
    }
    return this.asrInstance;
  }

  // audioBase64 lives only in this call's stack frame — never written to disk,
  // never inserted into any table, never logged. It goes out of scope on return.
  async transcribe(dto: VoiceTranscribeDto) {
    try {
      const { text, translatedText } = await this.asr.transcribe(dto.audioBase64, dto.language);
      return { transcript: text, translatedText };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException((err as Error).message);
    }
  }
}
