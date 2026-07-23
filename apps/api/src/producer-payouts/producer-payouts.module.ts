import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ProducerPayoutsController } from "./producer-payouts.controller";
import { ProducerPayoutsService } from "./producer-payouts.service";

@Module({
  imports: [AuditModule],
  controllers: [ProducerPayoutsController],
  providers: [ProducerPayoutsService],
})
export class ProducerPayoutsModule {}
