import { Body, Controller, Post } from "@nestjs/common";
import { TranslateDtoSchema } from "@datapay/shared";
import { parseOrThrow } from "../zod.util";
import { TranslationService } from "./translation.service";

@Controller("v1/admin/translate")
export class TranslationController {
  constructor(private readonly translation: TranslationService) {}

  @Post()
  translate(@Body() body: unknown) {
    const dto = parseOrThrow(TranslateDtoSchema, body);
    return this.translation.translate(dto.text, dto.targetLang);
  }
}
