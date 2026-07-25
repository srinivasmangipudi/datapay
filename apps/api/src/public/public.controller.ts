import { Controller, Get } from "@nestjs/common";
import { PublicService } from "./public.service";

// Deliberately no auth guard, ever — see PublicService for why this is safe.
@Controller("v1/public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get("registry")
  getRegistry() {
    return this.publicService.getRegistry();
  }
}
