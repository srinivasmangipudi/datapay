import { Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { OrgProductsService } from "./org-products.service";

// Ops-only surface, same unauthenticated-for-now posture as every other
// v1/admin/* route (the portal's shared password is the only gate).
@Controller("v1/admin/org-products")
export class OrgProductsAdminController {
  constructor(private readonly orgProducts: OrgProductsService) {}

  @Get("pending")
  listPending() {
    return this.orgProducts.listPendingReview();
  }

  @Post(":id/approve")
  approve(@Param("id", ParseIntPipe) id: number) {
    return this.orgProducts.review(id, "approved");
  }

  @Post(":id/reject")
  reject(@Param("id", ParseIntPipe) id: number) {
    return this.orgProducts.review(id, "rejected");
  }

  @Get("orders")
  listOrders() {
    return this.orgProducts.listAllOrdersForOps();
  }
}
