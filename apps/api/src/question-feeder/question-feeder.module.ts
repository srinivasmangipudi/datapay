import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { Inject, Module, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { IntelligenceModule } from "../intelligence/intelligence.module";
import { QuestionFeederController } from "./question-feeder.controller";
import { QuestionFeederService } from "./question-feeder.service";
import { QUESTION_GENERATION_QUEUE, QuestionGenerationProcessor } from "./question-generation.processor";

@Module({
  imports: [IntelligenceModule, BullModule.registerQueue({ name: QUESTION_GENERATION_QUEUE })],
  controllers: [QuestionFeederController],
  providers: [QuestionFeederService, QuestionGenerationProcessor],
})
export class QuestionFeederModule implements OnModuleInit {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(getQueueToken(QUESTION_GENERATION_QUEUE)) private readonly queue: Queue
  ) {}

  // Re-registers every scheduled topic's repeat job on boot — upsertJobScheduler
  // is keyed by id, so this is a safe no-op for a topic whose scheduler
  // already exists in Redis. This is the safety net for topics created
  // before this feature existed, or if Redis's own state was ever lost.
  async onModuleInit() {
    const { rows } = await this.pool.query<{ id: number; schedule_cron: string }>(
      `SELECT id, schedule_cron FROM question_topics WHERE schedule_cron IS NOT NULL`
    );
    for (const { id, schedule_cron } of rows) {
      await this.queue.upsertJobScheduler(
        `topic-${id}`,
        { pattern: schedule_cron },
        { name: "generate", data: { topicId: id } }
      );
    }
  }
}
