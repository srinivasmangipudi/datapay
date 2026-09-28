import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProductsModule } from "../products/products.module";
import { MeController } from "./me.controller";

@Module({
  // Saving an address backfills relay mappings for orders placed before one
  // existed, so this controller needs ProductsService.
  imports: [AuthModule, ProductsModule],
  controllers: [MeController],
})
export class MeModule {}
