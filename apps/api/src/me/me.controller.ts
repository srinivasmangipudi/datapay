import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { CompleteOnboardingDtoSchema } from "@datapay/shared";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { AliasAuthGuard, AliasRequest } from "../auth/alias-auth.guard";
import { parseOrThrow } from "../zod.util";

interface MemberRow {
  alias_id: string;
  display_alias: string;
  zone_id: string;
  household_size_band: string | null;
  locale: string;
  joined_at: Date;
  status: string;
  trust_score: string;
}

function toMemberResponse(m: MemberRow) {
  return {
    aliasId: m.alias_id,
    displayAlias: m.display_alias,
    zoneId: m.zone_id,
    householdSizeBand: m.household_size_band,
    locale: m.locale,
    joinedAt: m.joined_at,
    status: m.status,
    trustScore: Number(m.trust_score),
  };
}

@Controller("v1/me")
@UseGuards(AliasAuthGuard)
export class MeController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async get(@Req() req: AliasRequest) {
    const { rows } = await this.pool.query<MemberRow>(
      `SELECT * FROM members WHERE alias_id = $1`,
      [req.aliasId]
    );
    if (!rows[0]) throw new NotFoundException("Onboarding not complete");
    return toMemberResponse(rows[0]);
  }

  // Onboarding completion: alias already exists (minted by Vault at verify-otp),
  // this just attaches a zone + locale. displayAlias comes from the JWT-holder's
  // own alias_map row — the client already has it from FIG.3's verify-otp response.
  @Put()
  async upsert(@Req() req: AliasRequest, @Body() body: unknown) {
    const dto = parseOrThrow(CompleteOnboardingDtoSchema, body);
    const { rows } = await this.pool.query<MemberRow>(
      `INSERT INTO members (alias_id, display_alias, zone_id, household_size_band, locale)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (alias_id) DO UPDATE SET
         zone_id = EXCLUDED.zone_id,
         household_size_band = EXCLUDED.household_size_band,
         locale = EXCLUDED.locale
       RETURNING *`,
      [req.aliasId, req.displayAlias, dto.zoneId, dto.householdSizeBand ?? null, dto.locale]
    );
    return toMemberResponse(rows[0]);
  }
}
