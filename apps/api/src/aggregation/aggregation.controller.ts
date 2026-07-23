import { Controller, Post } from "@nestjs/common";
import { AggregationService } from "./aggregation.service";

// Ops-only, same posture as the Question Feeder Engine admin surface —
// portal auth arrives with the restricted-role portal frontend (this phase
// builds the role and the read side; ops-write auth is a later hardening pass).
@Controller("v1/admin/aggregation")
export class AggregationController {
  constructor(private readonly aggregation: AggregationService) {}

  @Post("run")
  run() {
    return this.aggregation.runForAllCategories();
  }
}
