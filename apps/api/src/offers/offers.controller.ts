import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JoinOfferDtoSchema } from "@datapay/shared";
import { AliasAuthGuard, AliasRequest } from "../auth/alias-auth.guard";
import { parseOrThrow } from "../zod.util";
import { OffersService } from "./offers.service";

@Controller("v1/offers")
@UseGuards(AliasAuthGuard)
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(@Query("zone") zone?: string) {
    return this.offers.list(zone);
  }

  @Post(":id/join")
  join(@Req() req: AliasRequest, @Param("id", ParseIntPipe) id: number, @Body() body: unknown) {
    const dto = parseOrThrow(JoinOfferDtoSchema, body);
    return this.offers.join(req.aliasId, id, dto.qty, dto.tokensToRedeem);
  }

  @Delete(":id/join")
  leave(@Req() req: AliasRequest, @Param("id", ParseIntPipe) id: number) {
    return this.offers.leave(req.aliasId, id);
  }
}
