import { Module } from "@nestjs/common";
import { CorpusFundModule } from "../corpus-fund/corpus-fund.module";
import { AdminOverviewController } from "./admin-overview.controller";
import { AdminOverviewService } from "./admin-overview.service";

@Module({
  imports: [CorpusFundModule],
  controllers: [AdminOverviewController],
  providers: [AdminOverviewService],
})
export class AdminOverviewModule {}
