import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import { SnapDtoSchema } from "@datapay/shared";
import { AliasAuthGuard, AliasRequest } from "../auth/alias-auth.guard";
import { parseOrThrow } from "../zod.util";
import { SnapsService } from "./snaps.service";

@Controller("v1/snaps")
@UseGuards(AliasAuthGuard)
export class SnapsController {
  constructor(private readonly snaps: SnapsService) {}

  @Post()
  submit(@Req() req: AliasRequest, @Body() body: unknown) {
    const dto = parseOrThrow(SnapDtoSchema, body);
    return this.snaps.submit(req.aliasId, dto);
  }

  @Get()
  list(@Req() req: AliasRequest) {
    return this.snaps.list(req.aliasId);
  }
}

// Same deliberately-deferred-auth posture as the aggregation/token-rate/
// produce-matching/producer-payouts admin endpoints — ops-write auth is a
// later hardening pass (SPEC.md §19E).
@Controller("v1/admin/snaps")
export class AdminSnapsController {
  constructor(private readonly snaps: SnapsService) {}

  @Post(":id/verify")
  verify(@Param("id", ParseIntPipe) id: number) {
    return this.snaps.verify(id);
  }
}
