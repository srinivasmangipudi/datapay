import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { PulseAnswersBatchDtoSchema, type PulseAnswersBatchDto } from "@datapay/shared";
import { AliasAuthGuard, AliasRequest } from "../auth/alias-auth.guard";
import { parseOrThrow } from "../zod.util";
import { PulseService } from "./pulse.service";

@Controller("v1/pulse")
@UseGuards(AliasAuthGuard)
export class PulseController {
  constructor(private readonly pulse: PulseService) {}

  @Get("today")
  today(@Req() req: AliasRequest) {
    return this.pulse.today(req.aliasId);
  }

  @Post("answers")
  submitAnswers(@Req() req: AliasRequest, @Body() body: unknown) {
    const dto: PulseAnswersBatchDto = parseOrThrow(PulseAnswersBatchDtoSchema, body);
    return this.pulse.submitAnswers(req.aliasId, dto.answers, dto.deviceFingerprint);
  }
}
