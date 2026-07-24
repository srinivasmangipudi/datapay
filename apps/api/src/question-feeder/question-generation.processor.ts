import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { QUESTION_GENERATION_QUEUE } from "./question-generation-queue";
import { QuestionFeederService } from "./question-feeder.service";

export { QUESTION_GENERATION_QUEUE };

// One repeating job per topic (registered with jobId `topic-${id}` so
// re-registering on every app boot is a safe no-op, not a duplicate) — a
// scheduled run is identical to an ops admin clicking "Generate" by hand
// (SPEC.md §24): it only ever produces drafts, never bypasses review.
@Processor(QUESTION_GENERATION_QUEUE)
export class QuestionGenerationProcessor extends WorkerHost {
  constructor(private readonly feeder: QuestionFeederService) {
    super();
  }

  async process(job: Job<{ topicId: number }>) {
    return this.feeder.generate(job.data.topicId);
  }
}
