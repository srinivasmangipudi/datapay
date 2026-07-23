import { Module } from "@nestjs/common";
import { ProducerPayoutsController } from "./producer-payouts.controller";
import { ProducerPayoutsService } from "./producer-payouts.service";

@Module({
  controllers: [ProducerPayoutsController],
  providers: [ProducerPayoutsService],
})
export class ProducerPayoutsModule {}
