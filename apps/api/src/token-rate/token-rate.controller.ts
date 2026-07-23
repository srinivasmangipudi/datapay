import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AliasAuthGuard } from "../auth/alias-auth.guard";
import { TokenRateService } from "./token-rate.service";

@Controller("v1/token-rate")
export class TokenRateController {
  constructor(private readonly tokenRate: TokenRateService) {}

  // Member-facing (SPEC.md §9: "current + history") — any member can see the
  // published rate; it's not sensitive, it's the whole trust story (§6C).
  @Get()
  @UseGuards(AliasAuthGuard)
  async get() {
    const [current, history] = await Promise.all([
      this.tokenRate.current(),
      this.tokenRate.history(),
    ]);
    return { current, history };
  }
}

// Ops-only trigger, same posture as aggregation's admin endpoint.
@Controller("v1/admin/token-rate")
export class TokenRateAdminController {
  constructor(private readonly tokenRate: TokenRateService) {}

  @Post("run")
  run() {
    return this.tokenRate.computeAndPublish();
  }
}
