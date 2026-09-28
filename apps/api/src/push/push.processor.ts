import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PushService } from "./push.service";

export const PUSH_QUEUE = "push-nudge";

@Processor(PUSH_QUEUE)
export class PushProcessor extends WorkerHost {
  constructor(private readonly push: PushService) {
    super();
  }

  async process(_job: Job) {
    return this.push.sendPendingQuestionNudge();
  }
}
