import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LedgerModule } from "../ledger/ledger.module";
import { SnapsController } from "./snaps.controller";
import { SnapsService } from "./snaps.service";

@Module({
  imports: [AuthModule, LedgerModule],
  controllers: [SnapsController],
  providers: [SnapsService],
})
export class SnapsModule {}
