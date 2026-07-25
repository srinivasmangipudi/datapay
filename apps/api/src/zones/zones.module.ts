import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminZonesController } from "./admin-zones.controller";
import { ZonesController } from "./zones.controller";
import { ZoneGeocodingService } from "./zone-geocoding.service";
import { ZoneResolverService } from "./zone-resolver.service";

@Module({
  imports: [AuthModule],
  controllers: [ZonesController, AdminZonesController],
  providers: [ZoneResolverService, ZoneGeocodingService],
  exports: [ZoneResolverService],
})
export class ZonesModule {}
