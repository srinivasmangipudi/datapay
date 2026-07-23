import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { TokenRateService } from "./token-rate.service";

export const TOKEN_RATE_QUEUE = "token-rate";

@Processor(TOKEN_RATE_QUEUE)
export class TokenRateProcessor extends WorkerHost {
  constructor(private readonly tokenRate: TokenRateService) {
    super();
  }

  async process(_job: Job) {
    return this.tokenRate.computeAndPublish();
  }
}
