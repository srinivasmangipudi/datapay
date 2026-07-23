import { Module } from "@nestjs/common";
import { IntelligenceModule } from "../intelligence/intelligence.module";
import { QuestionFeederController } from "./question-feeder.controller";
import { QuestionFeederService } from "./question-feeder.service";

@Module({
  imports: [IntelligenceModule],
  controllers: [QuestionFeederController],
  providers: [QuestionFeederService],
})
export class QuestionFeederModule {}
