import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { TOKEN_RATE_CEILING_PAISE, TOKEN_RATE_FLOOR_PAISE } from "@datapay/shared";
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

  /**
   * Ops read of the same numbers the member endpoint serves, plus the bounds
   * and live input values the rate is derived from — so the portal can show
   * WHY the rate is what it is, not just what it is. The member endpoint is
   * alias-guarded and the portal has no alias, hence a separate route rather
   * than reusing it.
   */
  @Get()
  async detail() {
    const [current, history, inputs] = await Promise.all([
      this.tokenRate.current(),
      this.tokenRate.history(),
      this.tokenRate.liveInputs(),
    ]);
    return {
      current,
      history,
      inputs,
      floorPaise: TOKEN_RATE_FLOOR_PAISE,
      ceilingPaise: TOKEN_RATE_CEILING_PAISE,
    };
  }
}
