import { Body, Controller, Post } from "@nestjs/common";
import { VaultResolvePayoutDtoSchema, VaultSetPayoutInstrumentDtoSchema } from "@datapay/shared";
import { parseOrThrow } from "../zod.util";
import { PayoutService } from "./payout.service";

@Controller()
export class PayoutController {
  constructor(private readonly payout: PayoutService) {}

  @Post("payout-instrument")
  setInstrument(@Body() body: unknown) {
    const dto = parseOrThrow(VaultSetPayoutInstrumentDtoSchema, body);
    return this.payout.setPayoutInstrument(dto.aliasId, dto.upiId);
  }

  @Post("resolve-payout")
  resolvePayout(@Body() body: unknown) {
    const dto = parseOrThrow(VaultResolvePayoutDtoSchema, body);
    return this.payout.resolvePayoutBatch(dto.aliasIds);
  }
}
