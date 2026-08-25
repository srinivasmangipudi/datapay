import { Module } from "@nestjs/common";
import { CorpusFundService } from "./corpus-fund.service";

@Module({
  providers: [CorpusFundService],
  exports: [CorpusFundService],
})
export class CorpusFundModule {}
