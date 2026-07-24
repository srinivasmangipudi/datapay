import { Module } from "@nestjs/common";
import { AdminFraudController } from "./admin-fraud.controller";
import { FraudService } from "./fraud.service";

@Module({
  controllers: [AdminFraudController],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudModule {}
