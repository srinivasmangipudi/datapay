import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { RegisterPushTokenDtoSchema } from "@datapay/shared";
import { AliasAuthGuard } from "../auth/alias-auth.guard";
import type { AliasRequest } from "../auth/alias-auth.guard";
import { parseOrThrow } from "../zod.util";
import { PushService } from "./push.service";

// A thin proxy, same posture as /v1/me/delivery-address: the token itself
// never touches core_db, it goes straight to Vault.
@Controller("v1/me/push-token")
@UseGuards(AliasAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post()
  async register(@Req() req: AliasRequest, @Body() body: unknown) {
    const dto = parseOrThrow(RegisterPushTokenDtoSchema, body);
    return this.push.registerToken(req.aliasId, dto.token, dto.platform);
  }

  @Post("remove")
  async remove(@Body() body: unknown) {
    const dto = parseOrThrow(RegisterPushTokenDtoSchema.pick({ token: true }), body);
    await this.push.removeToken(dto.token);
    return { ok: true };
  }
}

// Ops trigger, same posture as aggregation's admin endpoint — lets someone
// verify the nudge end to end without waiting until 7am.
@Controller("v1/admin/push")
export class PushAdminController {
  constructor(private readonly push: PushService) {}

  @Post("run")
  run() {
    return this.push.sendPendingQuestionNudge();
  }
}
