import { Module } from "@nestjs/common";
import { AdminOverviewModule } from "./admin-overview/admin-overview.module";
import { AggregationModule } from "./aggregation/aggregation.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { ConsentsModule } from "./consents/consents.module";
import { CorpusFundModule } from "./corpus-fund/corpus-fund.module";
import { DbModule } from "./db/db.module";
import { FraudModule } from "./fraud/fraud.module";
import { IntelligenceModule } from "./intelligence/intelligence.module";
import { JobsModule } from "./jobs/bullmq.module";
import { LedgerModule } from "./ledger/ledger.module";
import { LinkagesModule } from "./linkages/linkages.module";
import { MeModule } from "./me/me.module";
import { OffersModule } from "./offers/offers.module";
import { ProduceModule } from "./produce/produce.module";
import { ProducerPayoutsModule } from "./producer-payouts/producer-payouts.module";
import { PublicModule } from "./public/public.module";
import { PulseModule } from "./pulse/pulse.module";
import { QuestionFeederModule } from "./question-feeder/question-feeder.module";
import { RelayModule } from "./relay/relay.module";
import { SnapsModule } from "./snaps/snaps.module";
import { TokenRateModule } from "./token-rate/token-rate.module";
import { TokensModule } from "./tokens/tokens.module";
import { TranslationModule } from "./translation/translation.module";
import { VoiceModule } from "./voice/voice.module";
import { ZonesModule } from "./zones/zones.module";

@Module({
  imports: [
    DbModule,
    JobsModule,
    AuthModule,
    MeModule,
    ZonesModule,
    CategoriesModule,
    LedgerModule,
    PulseModule,
    SnapsModule,
    VoiceModule,
    TokensModule,
    ConsentsModule,
    QuestionFeederModule,
    AggregationModule,
    TokenRateModule,
    OffersModule,
    RelayModule,
    LinkagesModule,
    ProduceModule,
    ProducerPayoutsModule,
    FraudModule,
    AuditModule,
    IntelligenceModule,
    TranslationModule,
    PublicModule,
    CorpusFundModule,
    AdminOverviewModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
