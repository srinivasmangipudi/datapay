import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LedgerModule } from "../ledger/ledger.module";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";

@Module({
  imports: [AuthModule, LedgerModule],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
