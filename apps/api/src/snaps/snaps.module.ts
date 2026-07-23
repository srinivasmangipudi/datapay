import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { FraudModule } from "../fraud/fraud.module";
import { LedgerModule } from "../ledger/ledger.module";
import { AdminSnapsController, SnapsController } from "./snaps.controller";
import { SnapsService } from "./snaps.service";

@Module({
  imports: [AuthModule, LedgerModule, FraudModule, AuditModule],
  controllers: [SnapsController, AdminSnapsController],
  providers: [SnapsService],
})
export class SnapsModule {}
