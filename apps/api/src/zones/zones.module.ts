import { Module } from "@nestjs/common";
import { AdminZonesController } from "./admin-zones.controller";
import { ZonesController } from "./zones.controller";

@Module({
  controllers: [ZonesController, AdminZonesController],
})
export class ZonesModule {}
