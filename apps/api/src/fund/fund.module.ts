import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReserveModule } from "../reserve/reserve.module";
import { FundAdminController, FundController } from "./fund.controller";
import { FundService } from "./fund.service";

@Module({
  imports: [AuthModule, ReserveModule],
  controllers: [FundController, FundAdminController],
  providers: [FundService],
  exports: [FundService],
})
export class FundModule {}
