import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LinkagesModule } from "../linkages/linkages.module";
import { AdminProduceController } from "./admin-produce.controller";
import { ProduceController } from "./produce.controller";
import { ProduceService } from "./produce.service";

@Module({
  imports: [AuthModule, LinkagesModule],
  controllers: [ProduceController, AdminProduceController],
  providers: [ProduceService],
})
export class ProduceModule {}
