import { getQueueToken, BullModule } from "@nestjs/bullmq";
import { Inject, Module, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { PushController, PushAdminController } from "./push.controller";
import { PushProcessor, PUSH_QUEUE } from "./push.processor";
import { PushService } from "./push.service";
import { AuthModule } from "../auth/auth.module";

// 07:00 IST. A cron, not `every`, because "morning" is a wall-clock idea —
// an interval would drift across the day on every redeploy and eventually
// nudge people at 3am. IST explicitly: the server runs in UTC and every
// member is in India.
const MORNING_NUDGE_CRON = "0 7 * * *";

@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: PUSH_QUEUE })],
  controllers: [PushController, PushAdminController],
  providers: [PushService, PushProcessor],
  exports: [PushService],
})
export class PushModule implements OnModuleInit {
  constructor(@Inject(getQueueToken(PUSH_QUEUE)) private readonly queue: Queue) {}

  async onModuleInit() {
    // jobId dedupes across restarts, same as aggregation's hourly job.
    await this.queue.add(
      "morning-nudge",
      {},
      { repeat: { pattern: MORNING_NUDGE_CRON, tz: "Asia/Kolkata" }, jobId: "push-morning-nudge" }
    );
  }
}
