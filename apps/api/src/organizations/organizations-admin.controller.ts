import { Body, Controller, Get, Post } from "@nestjs/common";
import { CreateOrganizationDtoSchema } from "@datapay/shared";
import { parseOrThrow } from "../zod.util";
import { OrganizationsService } from "./organizations.service";

// Ops-only (SPEC.md §14 posture) — same unauthenticated-at-the-API-layer
// surface as every other v1/admin/* controller; portal's shared password is
// the only gate, same as categories/question-feeder/etc.
@Controller("v1/admin/organizations")
export class OrganizationsAdminController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list() {
    return this.organizations.list();
  }

  @Post()
  create(@Body() body: unknown) {
    const dto = parseOrThrow(CreateOrganizationDtoSchema, body);
    return this.organizations.create(dto);
  }
}
