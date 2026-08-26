import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import type { OrgTokenPayload } from "./organizations.service";

export interface OrgRequest extends Request {
  organizationId: string;
}

// Mirrors AliasAuthGuard's shape but for a company account instead of a
// member alias — a distinct `type: "org"` claim keeps the two token kinds
// from ever being interchangeable even though they share JWT_SECRET.
@Injectable()
export class OrgAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<OrgRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    const token = header.slice("Bearer ".length);
    try {
      const payload = await this.jwt.verifyAsync<OrgTokenPayload>(token);
      if (payload.type !== "org") {
        throw new UnauthorizedException("Invalid token type");
      }
      req.organizationId = payload.organizationId;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
