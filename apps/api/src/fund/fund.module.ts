import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CorpusFundModule } from "../corpus-fund/corpus-fund.module";
import { LedgerModule } from "../ledger/ledger.module";
import { FundAdminController, FundController } from "./fund.controller";
import { FundService } from "./fund.service";

@Module({
  imports: [AuthModule, CorpusFundModule, LedgerModule],
  controllers: [FundController, FundAdminController],
  providers: [FundService],
  exports: [FundService],
})
export class FundModule {}
