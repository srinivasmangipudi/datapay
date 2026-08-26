import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { CreateQuestionDtoSchema, OrgLoginDtoSchema } from "@datapay/shared";
import { parseOrThrow } from "../zod.util";
import { OrgAuthGuard, OrgRequest } from "./org-auth.guard";
import { OrganizationsService } from "./organizations.service";

// Company-facing surface — a distinct login from the ops team's shared
// portal password (SPEC.md addendum: organizations onboarding questions).
@Controller("v1/org")
export class OrgController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post("login")
  login(@Body() body: unknown) {
    const dto = parseOrThrow(OrgLoginDtoSchema, body);
    return this.organizations.login(dto.email, dto.password);
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
