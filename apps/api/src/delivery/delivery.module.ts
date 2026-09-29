import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DeliveryAuthGuard } from "./delivery-auth.guard";
import { DeliveryAdminController, DeliveryController } from "./delivery.controller";
import { DeliveryService } from "./delivery.service";

@Module({
  imports: [AuthModule],
  controllers: [DeliveryController, DeliveryAdminController],
  providers: [DeliveryService, DeliveryAuthGuard],
})
export class DeliveryModule {}
