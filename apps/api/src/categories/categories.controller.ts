import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { CreateCategoryDtoSchema, MergeCategoriesDtoSchema } from "@datapay/shared";
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

  // Declared before ":id/usage" would matter only if that route could match
  // "merge" — it can't (ParseIntPipe), but keeping the literal first is the
  // habit that avoids the bug when a non-numeric param shows up later.
  @Post("merge")
  merge(@Body() body: unknown) {
    const dto = parseOrThrow(MergeCategoriesDtoSchema, body);
    return this.categories.merge(dto.sourceId, dto.targetId);
  }

  @Get(":id/usage")
  usage(@Param("id", ParseIntPipe) id: number) {
    return this.categories.usage(id);
  }
}
