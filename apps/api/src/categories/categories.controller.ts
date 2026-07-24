import { Body, Controller, Get, Post } from "@nestjs/common";
import { CreateCategoryDtoSchema } from "@datapay/shared";
import { parseOrThrow } from "../zod.util";
import { CategoriesService } from "./categories.service";

@Controller("v1/admin/categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  create(@Body() body: unknown) {
    const dto = parseOrThrow(CreateCategoryDtoSchema, body);
    return this.categories.create(dto);
  }
}
