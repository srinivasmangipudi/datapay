import { Body, Controller, Get, Param, ParseIntPipe, Put, Req, UseGuards } from "@nestjs/common";
import { ConsentUpdateDtoSchema } from "@datapay/shared";
import { AliasAuthGuard, AliasRequest } from "../auth/alias-auth.guard";
import { parseOrThrow } from "../zod.util";
import { ConsentsService } from "./consents.service";

@Controller("v1/vault/consents")
@UseGuards(AliasAuthGuard)
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  @Get()
  list(@Req() req: AliasRequest) {
    return this.consents.list(req.aliasId);
  }

  @Put(":categoryId")
  setConsent(
    @Req() req: AliasRequest,
    @Param("categoryId", ParseIntPipe) categoryId: number,
    @Body() body: unknown
  ) {
    const dto = parseOrThrow(ConsentUpdateDtoSchema, body);
    return this.consents.setConsent(req.aliasId, categoryId, dto.granted);
  }
}
