import { Body, Controller, Post } from "@nestjs/common";
import {
  VaultRegisterRelayMapDtoSchema,
  VaultResolveRelayDtoSchema,
  VaultSetDeliveryAddressDtoSchema,
} from "@datapay/shared";
import { parseOrThrow } from "../zod.util";
import { RelayService } from "./relay.service";

// Extends Vault's external surface beyond §5A's original four endpoints —
// documented in SPEC.md §16. Each endpoint is still single-purpose and
// PII-minimal: none of these return a phone number or user_id.
@Controller()
export class RelayController {
  constructor(private readonly relay: RelayService) {}

  @Post("delivery-address")
  setDeliveryAddress(@Body() body: unknown) {
    const dto = parseOrThrow(VaultSetDeliveryAddressDtoSchema, body);
    return this.relay.setDeliveryAddress(dto.aliasId, dto.address, dto.zoneHint);
  }

  @Post("relay-map")
  registerRelayMap(@Body() body: unknown) {
    const dto = parseOrThrow(VaultRegisterRelayMapDtoSchema, body);
    return this.relay.registerRelayMap(dto.aliasId, dto.relayToken, dto.offerRef, dto.expiresAt);
  }

  @Post("resolve-relay")
  resolveRelay(@Body() body: unknown) {
    const dto = parseOrThrow(VaultResolveRelayDtoSchema, body);
    return this.relay.resolveRelay(dto.relayToken);
  }
}
