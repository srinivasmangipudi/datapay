import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { Inject, Module, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { AuthModule } from "../auth/auth.module";
import { TokenRateAdminController, TokenRateController } from "./token-rate.controller";
import { TokenRateProcessor, TOKEN_RATE_QUEUE } from "./token-rate.processor";
import { TokenRateService } from "./token-rate.service";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // SPEC.md §6C: "on a fixed cadence, default every 3 days"

@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: TOKEN_RATE_QUEUE })],
  controllers: [TokenRateController, TokenRateAdminController],
  providers: [TokenRateService, TokenRateProcessor],
})
export class TokenRateModule implements OnModuleInit {
  constructor(@Inject(getQueueToken(TOKEN_RATE_QUEUE)) private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      "run",
      {},
      { repeat: { every: THREE_DAYS_MS }, jobId: "token-rate-3day" }
    );
  }
}
