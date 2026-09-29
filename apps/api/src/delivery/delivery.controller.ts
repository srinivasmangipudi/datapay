import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import {
  CreateDeliveryAgentDtoSchema,
  DeliveryLoginDtoSchema,
  ResetDeliveryPasswordDtoSchema,
  SetDeliveryAgentActiveDtoSchema,
} from "@datapay/shared";
import { parseOrThrow } from "../zod.util";
import { DeliveryAuthGuard, DeliveryRequest } from "./delivery-auth.guard";
import { DeliveryService } from "./delivery.service";

// The delivery person's own surface. Public login, everything else guarded.
@Controller("v1/delivery")
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post("login")
  login(@Body() body: unknown) {
    const dto = parseOrThrow(DeliveryLoginDtoSchema, body);
    return this.delivery.login(dto.phone, dto.password);
  }

  @Get("deliveries")
  @UseGuards(DeliveryAuthGuard)
  myDeliveries(@Req() req: DeliveryRequest) {
    return this.delivery.myDeliveries(req.agentId);
  }
}

// Ops-only, same unauthenticated-for-now posture as every other v1/admin/*
// route (the portal's shared password is the gate).
@Controller("v1/admin/delivery-agents")
export class DeliveryAdminController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  list() {
    return this.delivery.list();
  }

  @Post()
  create(@Body() body: unknown) {
    const dto = parseOrThrow(CreateDeliveryAgentDtoSchema, body);
    return this.delivery.create(dto);
  }

  @Post(":id/active")
  setActive(@Param("id") id: string, @Body() body: unknown) {
    const dto = parseOrThrow(SetDeliveryAgentActiveDtoSchema, body);
    return this.delivery.setActive(id, dto.active);
  }

  @Post(":id/password")
  resetPassword(@Param("id") id: string, @Body() body: unknown) {
    const dto = parseOrThrow(ResetDeliveryPasswordDtoSchema, body);
    return this.delivery.resetPassword(id, dto.password);
  }
}
