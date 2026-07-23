import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";

export interface AliasRequest extends Request {
  aliasId: string;
  displayAlias: string;
}

// Core never mints this token, only verifies it — Vault is the sole issuer, so the
// only claim that can ever be present is aliasId. See SPEC.md §9 / FIG.3.
@Injectable()
export class AliasAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AliasRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    const token = header.slice("Bearer ".length);
    try {
      const payload = await this.jwt.verifyAsync<{ aliasId: string; displayAlias: string }>(
        token
      );
      req.aliasId = payload.aliasId;
      req.displayAlias = payload.displayAlias;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
