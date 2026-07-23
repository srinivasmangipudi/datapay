import { Module } from "@nestjs/common";
import { DocumentGroundedGeneratorService } from "./document-grounded-generator.service";
import { IntelligenceSourcesController, ZoneUnderstandingController } from "./intelligence.controller";
import { IntelligenceSourcesService } from "./intelligence-sources.service";
import { ZoneUnderstandingService } from "./zone-understanding.service";

@Module({
  controllers: [IntelligenceSourcesController, ZoneUnderstandingController],
  providers: [IntelligenceSourcesService, ZoneUnderstandingService, DocumentGroundedGeneratorService],
  exports: [IntelligenceSourcesService, ZoneUnderstandingService, DocumentGroundedGeneratorService],
})
export class IntelligenceModule {}
