import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import { OrderProductDtoSchema } from "@datapay/shared";
import { AliasAuthGuard, AliasRequest } from "../auth/alias-auth.guard";
import { parseOrThrow } from "../zod.util";
import { ProductsService } from "./products.service";

@Controller("v1/products")
@UseGuards(AliasAuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  browse(@Req() req: AliasRequest) {
    return this.products.browse(req.aliasId);
  }

  @Get("orders")
  listMyOrders(@Req() req: AliasRequest) {
    return this.products.listMyOrders(req.aliasId);
  }

  @Post(":id/order")
  order(@Req() req: AliasRequest, @Param("id", ParseIntPipe) id: number, @Body() body: unknown) {
    const dto = parseOrThrow(OrderProductDtoSchema, body);
    return this.products.order(req.aliasId, id, dto.quantity);
  }
}
