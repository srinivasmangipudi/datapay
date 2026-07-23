import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { DbModule } from "./db/db.module";
import { RelayModule } from "./relay/relay.module";

@Module({
  imports: [DbModule, AuthModule, RelayModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
