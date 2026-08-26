import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgAuthGuard } from "./org-auth.guard";
import { OrgController } from "./org.controller";
import { OrganizationsAdminController } from "./organizations-admin.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsAdminController, OrgController],
  providers: [OrganizationsService, OrgAuthGuard],
})
export class OrganizationsModule {}
