import { Controller, Get, Post } from "@nestjs/common";
import { ProducerPayoutsService } from "./producer-payouts.service";

// Same deliberately-deferred-auth posture as the aggregation/token-rate admin
// endpoints (SPEC.md §12 Phase 3) — ops-write auth is a later hardening pass.
@Controller("v1/admin/producer-payouts")
export class ProducerPayoutsController {
  constructor(private readonly payouts: ProducerPayoutsService) {}

  @Post("run")
  run() {
    return this.payouts.runPayouts();
  }

  @Get()
  list() {
    return this.payouts.list();
  }
}
