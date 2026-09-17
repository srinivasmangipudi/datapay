import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { AggregationRunResult, AggregationService } from "./aggregation.service";

export const AGGREGATION_QUEUE = "aggregation";

export interface AggregationJobResult {
  categories: Record<string, AggregationRunResult>;
  questionStats: AggregationRunResult;
}

@Processor(AGGREGATION_QUEUE)
export class AggregationProcessor extends WorkerHost {
  constructor(private readonly aggregation: AggregationService) {
    super();
  }

  // Both passes run on the same schedule and from the same responses — the
  // public registry's category-level cards and its per-question detail must
  // never be computed from different snapshots of the data.
  async process(_job: Job): Promise<AggregationJobResult> {
    const categories = await this.aggregation.runForAllCategories();
    const questionStats = await this.aggregation.runQuestionStats();
    return { categories, questionStats };
  }
}
