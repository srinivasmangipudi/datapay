import { Body, Controller, Post } from "@nestjs/common";
import {
  VaultRegisterPushTokenDtoSchema,
  VaultRemovePushTokenDtoSchema,
  VaultResolvePushTokensDtoSchema,
} from "@datapay/shared";
import { parseOrThrow } from "../zod.util";
import { PushService } from "./push.service";

// Same posture as the other Vault routes: single-purpose, PII-minimal, and
// nothing here returns a phone number or a user_id.
@Controller()
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post("push-token")
  register(@Body() body: unknown) {
    const dto = parseOrThrow(VaultRegisterPushTokenDtoSchema, body);
    return this.push.register(dto.aliasId, dto.token, dto.platform);
  }

  @Post("push-token/remove")
  remove(@Body() body: unknown) {
    const dto = parseOrThrow(VaultRemovePushTokenDtoSchema, body);
    return this.push.remove(dto.token);
  }

  @Post("resolve-push-tokens")
  resolve(@Body() body: unknown) {
    const dto = parseOrThrow(VaultResolvePushTokensDtoSchema, body);
    return this.push.resolveBatch(dto.aliasIds);
  }
}
