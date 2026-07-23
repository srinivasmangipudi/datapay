import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { QuestionTopicDtoSchema } from "@datapay/shared";
import { parseOrThrow } from "../zod.util";
import { QuestionFeederService } from "./question-feeder.service";

// Ops-only surface (SPEC.md §14). Unauthenticated for now — ops auth arrives
// with the restricted-role portal in Phase 3, same as the rest of the admin API.
@Controller("v1/admin")
export class QuestionFeederController {
  constructor(private readonly feeder: QuestionFeederService) {}

  @Post("question-topics")
  createTopic(@Body() body: unknown) {
    const dto = parseOrThrow(QuestionTopicDtoSchema, body);
    return this.feeder.createTopic(dto);
  }

  @Post("question-topics/:id/generate")
  generate(@Param("id", ParseIntPipe) id: number) {
    return this.feeder.generate(id);
  }

  @Get("question-generation-runs/:id")
  getRun(@Param("id", ParseIntPipe) id: number) {
    return this.feeder.getRun(id);
  }

  @Get("questions")
  listQuestions(@Query("review_state") reviewState?: string) {
    return this.feeder.listQuestionsByReviewState(reviewState ?? "draft");
  }

  @Post("questions/:id/approve")
  approve(@Param("id", ParseIntPipe) id: number) {
    return this.feeder.review(id, "approved");
  }

  @Post("questions/:id/reject")
  reject(@Param("id", ParseIntPipe) id: number) {
    return this.feeder.review(id, "rejected");
  }
}
