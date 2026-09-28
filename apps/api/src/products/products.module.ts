import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LedgerModule } from "../ledger/ledger.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [AuthModule, LedgerModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
