import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { DbModule } from "./db/db.module";
import { PayoutModule } from "./payout/payout.module";
import { DeliveryPhoneModule } from "./delivery/delivery-phone.module";
import { PushModule } from "./push/push.module";
import { RelayModule } from "./relay/relay.module";

@Module({
  imports: [DbModule, AuthModule, RelayModule, PayoutModule, PushModule, DeliveryPhoneModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
