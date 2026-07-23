import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { VoiceTranscribeDtoSchema } from "@datapay/shared";
import { AliasAuthGuard } from "../auth/alias-auth.guard";
import { parseOrThrow } from "../zod.util";
import { VoiceService } from "./voice.service";

@Controller("v1/voice")
@UseGuards(AliasAuthGuard)
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Post("transcribe")
  transcribe(@Body() body: unknown) {
    const dto = parseOrThrow(VoiceTranscribeDtoSchema, body);
    return this.voice.transcribe(dto);
  }
}
