import { Body, Controller, HttpException, Post } from "@nestjs/common";
import { ResolveRelayRequestDtoSchema } from "@datapay/shared";
import { parseOrThrow } from "../zod.util";

// Node operator app surface (§7) — a thin proxy straight to Vault, same
// posture as the auth proxy (FIG.3/FIG.4). Node-operator auth is a follow-up
// hardening step, same note as the admin endpoints.
@Controller("v1/relay")
export class RelayController {
  @Post("resolve")
  async resolve(@Body() body: unknown) {
    const dto = parseOrThrow(ResolveRelayRequestDtoSchema, body);
    const vaultUrl = process.env.VAULT_INTERNAL_URL;
    if (!vaultUrl) throw new Error("Missing VAULT_INTERNAL_URL");

    const res = await fetch(`${vaultUrl}/resolve-relay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relayToken: dto.relayToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new HttpException(data, res.status);
    return data;
  }
}
