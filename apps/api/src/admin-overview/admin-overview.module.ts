import { Module } from "@nestjs/common";
import { ReserveModule } from "../reserve/reserve.module";
import { TokenRateModule } from "../token-rate/token-rate.module";
import { AdminOverviewController } from "./admin-overview.controller";
import { AdminOverviewService } from "./admin-overview.service";

@Module({
  imports: [ReserveModule, TokenRateModule],
  controllers: [AdminOverviewController],
  providers: [AdminOverviewService],
})
export class AdminOverviewModule {}
