import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LinkagesController, MatchingAdminController } from "./linkages.controller";
import { LinkagesService } from "./linkages.service";

@Module({
  imports: [AuthModule],
  controllers: [LinkagesController, MatchingAdminController],
  providers: [LinkagesService],
  exports: [LinkagesService],
})
export class LinkagesModule {}
