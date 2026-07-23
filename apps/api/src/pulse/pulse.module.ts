import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LedgerModule } from "../ledger/ledger.module";
import { PulseController } from "./pulse.controller";
import { PulseService } from "./pulse.service";

@Module({
  imports: [AuthModule, LedgerModule],
  controllers: [PulseController],
  providers: [PulseService],
})
export class PulseModule {}
