import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { CreateCategoryDtoSchema, CreateOrganizationDtoSchema, CreateQuestionDtoSchema, OrgLoginDtoSchema } from "@datapay/shared";
import { CategoriesService } from "../categories/categories.service";
import { parseOrThrow } from "../zod.util";
import { OrgAuthGuard, OrgRequest } from "./org-auth.guard";
import { OrganizationsService } from "./organizations.service";

// Company-facing surface — a distinct login from the ops team's shared
// portal password (SPEC.md addendum: organizations onboarding questions).
@Controller("v1/org")
export class OrgController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly categories: CategoriesService
  ) {}

  // Org-scoped mirrors of the admin category routes. The org portal used to
  // call /v1/admin/categories directly, which worked only because admin
  // routes are unauthenticated today — a company-facing flow shouldn't be
  // reaching into an ops surface.
  @UseGuards(OrgAuthGuard)
  @Get("categories")
  listCategories() {
    return this.categories.list();
  }

  /**
   * Find-or-create by slug, so an org can name a category that doesn't exist
   * yet instead of being limited to a fixed list. Two things are deliberately
   * NOT the org's to decide:
   *  - `sensitivity` is forced to 'standard' — classifying a category is an
   *    ops judgment, not a supplier's.
   *  - `published` stays at its column default of false, so a category an org
   *    invents can never surface in the public demand registry until ops
   *    publishes it.
   */
  @UseGuards(OrgAuthGuard)
  @Post("categories")
  resolveCategory(@Body() body: unknown) {
    const dto = parseOrThrow(CreateCategoryDtoSchema, body);
    return this.categories.create({ name: dto.name, nameKn: dto.nameKn, sensitivity: "standard" });
  }

  // Public, unauthenticated — same posture as login below. Lands inactive;
  // see OrganizationsService.signup().
  @Post("signup")
  signup(@Body() body: unknown) {
    const dto = parseOrThrow(CreateOrganizationDtoSchema, body);
    return this.organizations.signup(dto);
  }

  @Post("login")
  login(@Body() body: unknown) {
    const dto = parseOrThrow(OrgLoginDtoSchema, body);
    return this.organizations.login(dto.email, dto.password);
  }

  @UseGuards(OrgAuthGuard)
  @Get("me")
  getOwnProfile(@Req() req: OrgRequest) {
    return this.organizations.getOwnProfile(req.organizationId);
  }

  @UseGuards(OrgAuthGuard)
  @Post("questions")
  submitQuestion(@Req() req: OrgRequest, @Body() body: unknown) {
    const dto = parseOrThrow(CreateQuestionDtoSchema, body);
    return this.organizations.createOrgQuestion(req.organizationId, dto);
  }

  @UseGuards(OrgAuthGuard)
  @Get("questions")
  listQuestions(@Req() req: OrgRequest) {
    return this.organizations.listOwnQuestions(req.organizationId);
  }
}
