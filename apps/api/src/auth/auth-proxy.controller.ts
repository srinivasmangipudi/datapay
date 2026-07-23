import { Body, Controller, HttpException, Post } from "@nestjs/common";
import { RegisterDtoSchema, VerifyOtpDtoSchema } from "@datapay/shared";
import { parseOrThrow } from "../zod.util";

// Mobile talks ONLY to Core API for auth — Vault is never internet-facing.
// This controller is a thin, unauthenticated proxy: it forwards to Vault's
// internal endpoints and relays the response, never touching core_db.
@Controller("v1/auth/otp")
export class AuthProxyController {
  private get vaultUrl(): string {
    const url = process.env.VAULT_INTERNAL_URL;
    if (!url) throw new Error("Missing VAULT_INTERNAL_URL");
    return url;
  }

  @Post("request")
  async request(@Body() body: unknown) {
    const dto = parseOrThrow(RegisterDtoSchema, body);
    return this.forward("/register", dto);
  }

  @Post("verify")
  async verify(@Body() body: unknown) {
    const dto = parseOrThrow(VerifyOtpDtoSchema, body);
    return this.forward("/verify-otp", dto);
  }

  private async forward(path: string, body: unknown) {
    const res = await fetch(`${this.vaultUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new HttpException(data, res.status);
    }
    return data;
  }
}
