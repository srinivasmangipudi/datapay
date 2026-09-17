import { Global, Module } from "@nestjs/common";
import { KAnonService } from "./k-anon.service";

// Global — both the aggregation job (what to compute) and the public registry
// (how to label what it publishes) need the same resolved floor, and neither
// should be able to obtain a different one.
@Global()
@Module({
  providers: [KAnonService],
  exports: [KAnonService],
})
export class KAnonModule {}
