import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { AggregationService } from "./aggregation.service";

export const AGGREGATION_QUEUE = "aggregation";

@Processor(AGGREGATION_QUEUE)
export class AggregationProcessor extends WorkerHost {
  constructor(private readonly aggregation: AggregationService) {
    super();
  }

  async process(_job: Job): Promise<Record<string, { published: number; suppressed: number }>> {
    return this.aggregation.runForAllCategories();
  }
}
