import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ConsentsModule } from "./consents/consents.module";
import { DbModule } from "./db/db.module";
import { LedgerModule } from "./ledger/ledger.module";
import { MeModule } from "./me/me.module";
import { PulseModule } from "./pulse/pulse.module";
import { QuestionFeederModule } from "./question-feeder/question-feeder.module";
import { SnapsModule } from "./snaps/snaps.module";
import { TokensModule } from "./tokens/tokens.module";
import { VoiceModule } from "./voice/voice.module";
import { ZonesModule } from "./zones/zones.module";

@Module({
  imports: [
    DbModule,
    AuthModule,
    MeModule,
    ZonesModule,
    LedgerModule,
    PulseModule,
    SnapsModule,
    VoiceModule,
    TokensModule,
    ConsentsModule,
    QuestionFeederModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
