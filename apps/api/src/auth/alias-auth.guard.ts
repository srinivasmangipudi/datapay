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

// Vault mints member tokens as { aliasId, displayAlias } with NO `type` claim.
//
// This guard used to accept any token that merely VERIFIED, on the stated
// assumption that "Vault is the sole issuer, so the only claim that can ever be
// present is aliasId". That was true when written and is not any more: Core now
// mints org tokens (type: "org") and delivery-agent tokens (type: "delivery"),
// all signed with the same JWT_SECRET. A delivery passcode therefore
// authenticated against member endpoints — aliasId came through undefined so
// queries returned nothing, but it was an authentication bypass waiting for the
// first query that handled a missing alias loosely.
//
// So: a member token is one that carries an aliasId and carries NO type. Both
// halves matter — the absent type rejects Core-minted tokens, and the required
// aliasId rejects anything else that happens to share the secret.
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
      const payload = await this.jwt.verifyAsync<{
        aliasId?: string;
        displayAlias?: string;
        type?: string;
      }>(token);
      if (payload.type !== undefined || !payload.aliasId) {
        throw new UnauthorizedException("Invalid token type");
      }
      req.aliasId = payload.aliasId;
      req.displayAlias = payload.displayAlias ?? "";
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
