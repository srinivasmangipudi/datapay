import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { ConnectIntelligenceSourceDtoSchema } from "@datapay/shared";
import { parseOrThrow } from "../zod.util";
import { IntelligenceSourcesService } from "./intelligence-sources.service";
import { ZoneUnderstandingService } from "./zone-understanding.service";

// Same deliberately-deferred-auth posture as every other admin endpoint in
// this codebase — ops-write auth is a later hardening pass (SPEC.md §19E).
@Controller("v1/admin/intelligence-sources")
export class IntelligenceSourcesController {
  constructor(private readonly sources: IntelligenceSourcesService) {}

  @Post()
  connect(@Body() body: unknown) {
    const dto = parseOrThrow(ConnectIntelligenceSourceDtoSchema, body);
    return this.sources.connectSource(dto.zoneId, dto.externalRef, dto.displayName, dto.kind);
  }

  @Get()
  list(@Query("zoneId") zoneId?: string) {
    return this.sources.listSources(zoneId);
  }

  @Post(":id/sync")
  sync(@Param("id", ParseIntPipe) id: number) {
    return this.sources.sync(id);
  }

  @Get(":id/documents")
  documents(@Param("id", ParseIntPipe) id: number) {
    return this.sources.listDocuments(id);
  }
}

@Controller("v1/admin/zones/:zoneId/understanding")
export class ZoneUnderstandingController {
  constructor(private readonly understanding: ZoneUnderstandingService) {}

  @Post("refresh")
  refresh(@Param("zoneId") zoneId: string) {
    return this.understanding.refresh(zoneId);
  }

  @Get()
  async latest(@Param("zoneId") zoneId: string) {
    const result = await this.understanding.getLatest(zoneId);
    return result ?? { message: "No understanding generated yet for this zone" };
  }
}
