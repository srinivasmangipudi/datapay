import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LinkagesModule } from "../linkages/linkages.module";
import { ProduceController } from "./produce.controller";
import { ProduceService } from "./produce.service";

@Module({
  imports: [AuthModule, LinkagesModule],
  controllers: [ProduceController],
  providers: [ProduceService],
})
export class ProduceModule {}
