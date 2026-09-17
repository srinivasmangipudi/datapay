import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { PublicService } from "./public.service";

// Deliberately no auth guard, ever — see PublicService for why this is safe.
@Controller("v1/public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get("registry")
  getRegistry() {
    return this.publicService.getRegistry();
  }

  @Get("organizations/:slug")
  async getOrganization(@Param("slug") slug: string) {
    const result = await this.publicService.getOrganizationCatalog(slug);
    if (!result) throw new NotFoundException(`Organization "${slug}" not found`);
    return result;
  }
}
