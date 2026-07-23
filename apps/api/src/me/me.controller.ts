import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  NotFoundException,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { CompleteOnboardingDtoSchema, SetDeliveryAddressDtoSchema } from "@datapay/shared";
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

  // A thin proxy, same posture as /v1/auth/otp/* (FIG.3): the address itself
  // never touches core_db, it goes straight to Vault. Needed so the relay
  // flow (§7) has somewhere to deliver to — not one of §5A's original four
  // Vault endpoints, documented as an addition in SPEC.md §16.
  @Post("delivery-address")
  async setDeliveryAddress(@Req() req: AliasRequest, @Body() body: unknown) {
    const dto = parseOrThrow(SetDeliveryAddressDtoSchema, body);
    const vaultUrl = process.env.VAULT_INTERNAL_URL;
    if (!vaultUrl) throw new Error("Missing VAULT_INTERNAL_URL");

    const res = await fetch(`${vaultUrl}/delivery-address`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliasId: req.aliasId, address: dto.address, zoneHint: dto.zoneHint }),
    });
    const data = await res.json();
    if (!res.ok) throw new HttpException(data, res.status);
    return data;
  }
}
