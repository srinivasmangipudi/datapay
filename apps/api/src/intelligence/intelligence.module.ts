import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { Inject, Module, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { DocumentGroundedGeneratorService } from "./document-grounded-generator.service";
import { INTELLIGENCE_REFRESH_QUEUE, IntelligenceRefreshProcessor } from "./intelligence-refresh.processor";
import { IntelligenceSourcesController, ZoneUnderstandingController } from "./intelligence.controller";
import { IntelligenceSourcesService } from "./intelligence-sources.service";
import { ZoneUnderstandingService } from "./zone-understanding.service";

const INTELLIGENCE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily (SPEC.md §24)

@Module({
  imports: [BullModule.registerQueue({ name: INTELLIGENCE_REFRESH_QUEUE })],
  controllers: [IntelligenceSourcesController, ZoneUnderstandingController],
  providers: [
    IntelligenceSourcesService,
    ZoneUnderstandingService,
    DocumentGroundedGeneratorService,
    IntelligenceRefreshProcessor,
  ],
  exports: [IntelligenceSourcesService, ZoneUnderstandingService, DocumentGroundedGeneratorService],
})
export class IntelligenceModule implements OnModuleInit {
  constructor(@Inject(getQueueToken(INTELLIGENCE_REFRESH_QUEUE)) private readonly queue: Queue) {}

  async onModuleInit() {
    // upsertJobScheduler (not queue.add's repeat+jobId option — that pair
    // doesn't dedupe the way it looks like it should, see SPEC.md §24) keys
    // this by id, so re-registering on every boot is a safe no-op.
    await this.queue.upsertJobScheduler(
      "intelligence-refresh-daily",
      { every: INTELLIGENCE_REFRESH_INTERVAL_MS },
      { name: "run", data: {} }
    );
  }
}
