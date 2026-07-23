import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AdvanceLinkageDtoSchema } from "@datapay/shared";
import { AliasAuthGuard, type AliasRequest } from "../auth/alias-auth.guard";
import { parseOrThrow } from "../zod.util";
import { LinkagesService } from "./linkages.service";

@Controller("v1/linkages")
@UseGuards(AliasAuthGuard)
export class LinkagesController {
  constructor(private readonly linkages: LinkagesService) {}

  @Post(":id/advance")
  advance(@Req() req: AliasRequest, @Param("id", ParseIntPipe) id: number, @Body() body: unknown) {
    const dto = parseOrThrow(AdvanceLinkageDtoSchema, body);
    return this.linkages.advance(req.aliasId, id, dto.toState);
  }
}

// Admin trigger for the internal-collective-first matching pass (SPEC.md §12
// Phase 6). No admin-role gate exists yet elsewhere in Core (Phase 3's ops
// portal restricts by a DB role, not a request-time check) — matching this
// codebase's existing precedent rather than inventing a new auth layer here.
@Controller("v1/admin/produce-matching")
export class MatchingAdminController {
  constructor(private readonly linkages: LinkagesService) {}

  @Post("run/:listingId")
  run(@Param("listingId", ParseIntPipe) listingId: number) {
    return this.linkages.matchListing(listingId);
  }
}
