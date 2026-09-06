import { Body, Controller, Post } from "@nestjs/common";
import {
  AliasCandidatesDtoSchema,
  CommitAliasDtoSchema,
  FirebaseVerifyDtoSchema,
  RegisterDtoSchema,
  VerifyOtpDtoSchema,
} from "@datapay/shared";
import { parseOrThrow } from "../zod.util";
import { AuthService } from "./auth.service";

// Vault's entire external surface. No "get user" endpoint exists here, by design —
// this list is exhaustive (SPEC.md §5A). resolve-payout / resolve-relay land in Phase 4.
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() body: unknown) {
    const dto = parseOrThrow(RegisterDtoSchema, body);
    return this.auth.register(dto.phoneE164, dto.name);
  }

  @Post("verify-otp")
  verifyOtp(@Body() body: unknown) {
    const dto = parseOrThrow(VerifyOtpDtoSchema, body);
    return this.auth.verifyOtp(dto.phoneE164, dto.otp);
  }

  // The phone was already proven by Firebase Phone Auth on-device — see
  // AuthService.verifyFirebaseToken.
  @Post("firebase-verify")
  firebaseVerify(@Body() body: unknown) {
    const dto = parseOrThrow(FirebaseVerifyDtoSchema, body);
    return this.auth.verifyFirebaseToken(dto.idToken, dto.name);
  }

  // SPEC.md §36 — a first-time verify-otp offers candidates but commits
  // nothing; these two close the loop (browse more / lock one in).
  @Post("alias-candidates")
  aliasCandidates(@Body() body: unknown) {
    const dto = parseOrThrow(AliasCandidatesDtoSchema, body);
    return this.auth.regenerateCandidates(dto.pendingToken);
  }

  @Post("commit-alias")
  commitAlias(@Body() body: unknown) {
    const dto = parseOrThrow(CommitAliasDtoSchema, body);
    return this.auth.commitAlias(dto.pendingToken, dto.displayAlias);
  }
}
