import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgAuthGuard } from "../organizations/org-auth.guard";
import { OrgProductsAdminController } from "./org-products-admin.controller";
import { OrgProductsController } from "./org-products.controller";
import { OrgProductsService } from "./org-products.service";

// OrgAuthGuard is re-provided here (not imported from OrganizationsModule,
// which exports nothing) — a stateless guard needing only JwtService
// (already global via AuthModule), so a second registration is harmless.
@Module({
  imports: [AuthModule],
  controllers: [OrgProductsController, OrgProductsAdminController],
  providers: [OrgProductsService, OrgAuthGuard],
})
export class OrgProductsModule {}
