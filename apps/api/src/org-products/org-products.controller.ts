import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import {
  CreateOrgProductDtoSchema,
  ImportOrgProductsDtoSchema,
  UpdateOrgProductDtoSchema,
  UploadOrgProductPhotoDtoSchema,
} from "@datapay/shared";
import { OrgAuthGuard, OrgRequest } from "../organizations/org-auth.guard";
import { parseOrThrow } from "../zod.util";
import { OrgProductsService } from "./org-products.service";

// Company-facing surface, same OrgAuthGuard posture as OrgController.
@Controller("v1/org/products")
@UseGuards(OrgAuthGuard)
export class OrgProductsController {
  constructor(private readonly orgProducts: OrgProductsService) {}

  @Get()
  list(@Req() req: OrgRequest) {
    return this.orgProducts.listOwnProducts(req.organizationId);
  }

  @Post()
  create(@Req() req: OrgRequest, @Body() body: unknown) {
    const dto = parseOrThrow(CreateOrgProductDtoSchema, body);
    return this.orgProducts.createProduct(req.organizationId, dto);
  }

  @Patch(":id")
  update(@Req() req: OrgRequest, @Param("id", ParseIntPipe) id: number, @Body() body: unknown) {
    const dto = parseOrThrow(UpdateOrgProductDtoSchema, body);
    return this.orgProducts.updateProduct(req.organizationId, id, dto);
  }

  @Post(":id/photo")
  uploadPhoto(@Req() req: OrgRequest, @Param("id", ParseIntPipe) id: number, @Body() body: unknown) {
    const dto = parseOrThrow(UploadOrgProductPhotoDtoSchema, body);
    return this.orgProducts.uploadPhoto(req.organizationId, id, dto.imageBase64);
  }

  @Post("import")
  importFromSheet(@Req() req: OrgRequest, @Body() body: unknown) {
    const dto = parseOrThrow(ImportOrgProductsDtoSchema, body);
    return this.orgProducts.importFromSheet(req.organizationId, dto.sheetUrl);
  }

  @Get("import-runs")
  listImportRuns(@Req() req: OrgRequest) {
    return this.orgProducts.listImportRuns(req.organizationId);
  }

  @Get("orders")
  listOrders(@Req() req: OrgRequest) {
    return this.orgProducts.listOwnOrders(req.organizationId);
  }
}
