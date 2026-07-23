import { Module } from "@nestjs/common";
import { QuestionFeederController } from "./question-feeder.controller";
import { QuestionFeederService } from "./question-feeder.service";

@Module({
  controllers: [QuestionFeederController],
  providers: [QuestionFeederService],
})
export class QuestionFeederModule {}
