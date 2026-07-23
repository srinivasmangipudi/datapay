import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ProduceListingDtoSchema,
  ProducerProfileDtoSchema,
  SetPayoutInstrumentDtoSchema,
} from "@datapay/shared";
import { AliasAuthGuard, type AliasRequest } from "../auth/alias-auth.guard";
import { parseOrThrow } from "../zod.util";
import { LinkagesService } from "../linkages/linkages.service";
import { ProduceService } from "./produce.service";

@Controller("v1/produce")
@UseGuards(AliasAuthGuard)
export class ProduceController {
  constructor(
    private readonly produce: ProduceService,
    private readonly linkages: LinkagesService
  ) {}

  @Post("profile")
  registerProfile(@Req() req: AliasRequest, @Body() body: unknown) {
    const dto = parseOrThrow(ProducerProfileDtoSchema, body);
    return this.produce.registerProfile(req.aliasId, dto);
  }

  @Post("listings")
  createListing(@Req() req: AliasRequest, @Body() body: unknown) {
    const dto = parseOrThrow(ProduceListingDtoSchema, body);
    return this.produce.createListing(req.aliasId, dto);
  }

  @Get("listings/:id/linkages")
  listingLinkages(@Req() req: AliasRequest, @Param("id", ParseIntPipe) id: number) {
    return this.linkages.listForListing(req.aliasId, id);
  }

  @Get("value-add")
  valueAdd(@Query("categoryId", ParseIntPipe) categoryId: number) {
    return this.produce.valueAddSuggestions(categoryId);
  }

  @Post("payout-instrument")
  setPayoutInstrument(@Req() req: AliasRequest, @Body() body: unknown) {
    const dto = parseOrThrow(SetPayoutInstrumentDtoSchema, body);
    return this.produce.setPayoutInstrument(req.aliasId, dto.upiId);
  }
}
