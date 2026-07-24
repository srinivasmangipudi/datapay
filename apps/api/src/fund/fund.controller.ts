import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import { CreateFundProjectDtoSchema, FundVoteDtoSchema } from "@datapay/shared";
import { AliasAuthGuard, AliasRequest } from "../auth/alias-auth.guard";
import { parseOrThrow } from "../zod.util";
import { FundService } from "./fund.service";

@Controller("v1/fund")
@UseGuards(AliasAuthGuard)
export class FundController {
  constructor(private readonly fund: FundService) {}

  @Get()
  async getBalance(@Req() req: AliasRequest) {
    const zoneId = await this.fund.getMemberZone(req.aliasId);
    return this.fund.getBalance(zoneId);
  }

  @Get("projects")
  async listProjects(@Req() req: AliasRequest) {
    const zoneId = await this.fund.getMemberZone(req.aliasId);
    return this.fund.listProjects(zoneId);
  }

  @Post("projects/:id/vote")
  vote(
    @Req() req: AliasRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown
  ) {
    const dto = parseOrThrow(FundVoteDtoSchema, body);
    return this.fund.vote(req.aliasId, id, dto.vote);
  }
}

// Ops-only, same posture as the other admin endpoints (auth is a follow-up hardening step).
@Controller("v1/admin/fund-projects")
export class FundAdminController {
  constructor(private readonly fund: FundService) {}

  @Get()
  list() {
    return this.fund.listAllProjects();
  }

  @Post()
  create(@Body() body: unknown) {
    const dto = parseOrThrow(CreateFundProjectDtoSchema, body);
    return this.fund.createProject(dto.zoneId, dto.title, dto.titleKn, dto.estimatePaise);
  }
}
