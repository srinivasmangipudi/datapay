import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { DbModule } from "./db/db.module";
import { MeModule } from "./me/me.module";
import { ZonesModule } from "./zones/zones.module";

@Module({
  imports: [DbModule, AuthModule, MeModule, ZonesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
