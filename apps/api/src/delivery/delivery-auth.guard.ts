import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import type { DeliveryTokenPayload } from "./delivery.service";

export interface DeliveryRequest extends Request {
  agentId: string;
}

// Same shape as OrgAuthGuard and AliasAuthGuard. The distinct `type: "delivery"`
// claim is what stops a member token or an org token being usable here even
// though all three are signed with JWT_SECRET.
@Injectable()
export class DeliveryAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<DeliveryRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    try {
      const payload = await this.jwt.verifyAsync<DeliveryTokenPayload>(
        header.slice("Bearer ".length)
      );
      if (payload.type !== "delivery") {
        throw new UnauthorizedException("Invalid token type");
      }
      req.agentId = payload.agentId;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
