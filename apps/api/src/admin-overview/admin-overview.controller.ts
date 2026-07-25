import { Controller, Get } from "@nestjs/common";
import { AdminOverviewService } from "./admin-overview.service";

// Ops-only, same posture as the other admin endpoints (auth is a follow-up
// hardening step, per fund.controller.ts/token-rate.controller.ts).
@Controller("v1/admin/token-economy")
export class AdminOverviewController {
  constructor(private readonly overview: AdminOverviewService) {}

  @Get("overview")
  get() {
    return this.overview.getOverview();
  }
}
