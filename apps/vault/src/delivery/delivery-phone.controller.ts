import { Body, Controller, Post } from "@nestjs/common";
import {
  VaultRegisterAgentPhoneDtoSchema,
  VaultResolveAgentPhoneDtoSchema,
  VaultResolveAgentPhonesDtoSchema,
} from "@datapay/shared";
import { parseOrThrow } from "../zod.util";
import { DeliveryPhoneService } from "./delivery-phone.service";

// POST throughout, so a phone number never lands in a URL or an access log
// line — the same posture as resolve-payout and resolve-delivery-address.
@Controller()
export class DeliveryPhoneController {
  constructor(private readonly phones: DeliveryPhoneService) {}

  @Post("delivery-agent-phone")
  register(@Body() body: unknown) {
    const dto = parseOrThrow(VaultRegisterAgentPhoneDtoSchema, body);
    return this.phones.register(dto.agentId, dto.phone);
  }

  @Post("resolve-delivery-agent-phone")
  async resolve(@Body() body: unknown) {
    const dto = parseOrThrow(VaultResolveAgentPhoneDtoSchema, body);
    return { agent: await this.phones.resolveByPhone(dto.phone) };
  }

  @Post("delivery-agent-phone/taken")
  async taken(@Body() body: unknown) {
    const dto = parseOrThrow(VaultResolveAgentPhoneDtoSchema, body);
    return { taken: await this.phones.isTaken(dto.phone) };
  }

  @Post("resolve-delivery-agent-phones")
  resolveBatch(@Body() body: unknown) {
    const dto = parseOrThrow(VaultResolveAgentPhonesDtoSchema, body);
    return this.phones.resolveBatch(dto.agentIds);
  }
}
