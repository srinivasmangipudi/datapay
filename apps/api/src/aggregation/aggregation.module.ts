import { getQueueToken, BullModule } from "@nestjs/bullmq";
import { Inject, Module, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { AggregationController } from "./aggregation.controller";
import { AggregationProcessor, AGGREGATION_QUEUE } from "./aggregation.processor";
import { AggregationService } from "./aggregation.service";

const AGGREGATION_INTERVAL_MS = 60 * 60 * 1000; // hourly refresh (SPEC.md §6: "scheduled + on-demand")

@Module({
  imports: [BullModule.registerQueue({ name: AGGREGATION_QUEUE })],
  controllers: [AggregationController],
  providers: [AggregationService, AggregationProcessor],
})
export class AggregationModule implements OnModuleInit {
  constructor(@Inject(getQueueToken(AGGREGATION_QUEUE)) private readonly queue: Queue) {}

  async onModuleInit() {
    // repeat.jobId dedupes across restarts — this is safe to call every boot.
    await this.queue.add(
      "run",
      {},
      { repeat: { every: AGGREGATION_INTERVAL_MS }, jobId: "aggregation-hourly" }
    );
  }
}
