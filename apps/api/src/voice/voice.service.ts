import { Injectable } from "@nestjs/common";
import type { VoiceTranscribeDto } from "@datapay/shared";
import { AsrProvider, DevNoopAsrProvider } from "./asr.provider";

@Injectable()
export class VoiceService {
  private readonly asr: AsrProvider = new DevNoopAsrProvider();

  // audioBase64 lives only in this call's stack frame — never written to disk,
  // never inserted into any table, never logged. It goes out of scope on return.
  async transcribe(dto: VoiceTranscribeDto) {
    const { text } = await this.asr.transcribe(dto.audioBase64, dto.language);
    return { transcript: text };
  }
}
