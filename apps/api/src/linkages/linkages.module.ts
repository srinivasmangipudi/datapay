import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { LinkagesController, MatchingAdminController } from "./linkages.controller";
import { LinkagesService } from "./linkages.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [LinkagesController, MatchingAdminController],
  providers: [LinkagesService],
  exports: [LinkagesService],
})
export class LinkagesModule {}
