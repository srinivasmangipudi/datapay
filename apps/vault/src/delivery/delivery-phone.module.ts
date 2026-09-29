import { Module } from "@nestjs/common";
import { DeliveryPhoneController } from "./delivery-phone.controller";
import { DeliveryPhoneService } from "./delivery-phone.service";

@Module({
  controllers: [DeliveryPhoneController],
  providers: [DeliveryPhoneService],
})
export class DeliveryPhoneModule {}
