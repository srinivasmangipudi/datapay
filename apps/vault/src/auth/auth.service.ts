import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { computeAliasId, generateDisplayAliasCandidate } from "./alias.util";
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  generateOtpCode,
  generateOtpSalt,
  hashOtpCode,
} from "./otp.util";

const MAX_DISPLAY_ALIAS_ATTEMPTS = 20;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly jwt: JwtService
  ) {}

  private get pepper(): string {
    const pepper = process.env.ALIAS_PEPPER;
    if (!pepper) throw new Error("Missing ALIAS_PEPPER");
    return pepper;
  }

  async register(phoneE164: string, name: string): Promise<{ status: "otp_sent" }> {
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO users (phone_e164, name) VALUES ($1, $2)
       ON CONFLICT (phone_e164) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [phoneE164, name]
    );
    const userId = rows[0].id;

    const code = generateOtpCode();
    const salt = generateOtpSalt();
    const codeHash = hashOtpCode(code, salt);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.pool.query(
      `INSERT INTO otp_codes (user_id, code_hash, code_salt, expires_at) VALUES ($1, $2, $3, $4)`,
      [userId, codeHash, salt, expiresAt]
    );

    // Dev-only delivery: no SMS provider wired yet (Bhashini/telco integration is an
    // infra follow-up, not part of LAW 1). Never return the code in the API response.
    // eslint-disable-next-line no-console
    console.log(`[vault][dev] OTP for ${phoneE164}: ${code}`);

    return { status: "otp_sent" };
  }

  async verifyOtp(
    phoneE164: string,
    otp: string
  ): Promise<{ token: string; aliasId: string; displayAlias: string }> {
    const { rows: userRows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM users WHERE phone_e164 = $1`,
      [phoneE164]
    );
    const user = userRows[0];
    if (!user) throw new UnauthorizedException("No pending registration for this phone");

    const { rows: otpRows } = await this.pool.query<{
      id: string;
      code_hash: string;
      code_salt: string;
      attempt_count: number;
    }>(
      `SELECT id, code_hash, code_salt, attempt_count FROM otp_codes
       WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    const pending = otpRows[0];
    if (!pending) throw new UnauthorizedException("No active OTP — request a new one");
    if (pending.attempt_count >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException("Too many attempts — request a new OTP");
    }

    const candidateHash = hashOtpCode(otp, pending.code_salt);
    if (candidateHash !== pending.code_hash) {
      await this.pool.query(
        `UPDATE otp_codes SET attempt_count = attempt_count + 1 WHERE id = $1`,
        [pending.id]
      );
      throw new UnauthorizedException("Incorrect OTP");
    }

    await this.pool.query(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1`, [
      pending.id,
    ]);

    const { aliasId, displayAlias } = await this.resolveOrCreateAlias(user.id);

    await this.pool.query(
      `INSERT INTO vault_access_log (service, purpose, alias_or_token) VALUES ($1, $2, $3)`,
      ["vault", "verify-otp", aliasId]
    );

    // displayAlias rides in the JWT alongside aliasId — it isn't PII (it's the
    // handle members/brands already see), so Core can read it here without ever
    // asking Vault "what's this alias" (that lookup path doesn't exist).
    const token = await this.jwt.signAsync({ aliasId, displayAlias });
    return { token, aliasId, displayAlias };
  }

  private async resolveOrCreateAlias(
    userId: string
  ): Promise<{ aliasId: string; displayAlias: string }> {
    const { rows } = await this.pool.query<{ alias_id: string; display_alias: string }>(
      `SELECT alias_id, display_alias FROM alias_map WHERE user_id = $1`,
      [userId]
    );
    if (rows[0]) {
      return { aliasId: rows[0].alias_id, displayAlias: rows[0].display_alias };
    }

    const aliasId = computeAliasId(userId, this.pepper);

    for (let attempt = 0; attempt < MAX_DISPLAY_ALIAS_ATTEMPTS; attempt++) {
      const displayAlias = generateDisplayAliasCandidate();
      try {
        await this.pool.query(
          `INSERT INTO alias_map (user_id, alias_id, display_alias) VALUES ($1, $2, $3)`,
          [userId, aliasId, displayAlias]
        );
        return { aliasId, displayAlias };
      } catch (err) {
        const isUniqueViolation = (err as { code?: string }).code === "23505";
        if (!isUniqueViolation) throw err;

        // Two concurrent verify-otp calls for the same user can both reach here — since
        // aliasId is deterministic, the loser isn't a display-alias collision, it's a race.
        const { rows: raced } = await this.pool.query<{
          alias_id: string;
          display_alias: string;
        }>(`SELECT alias_id, display_alias FROM alias_map WHERE user_id = $1`, [userId]);
        if (raced[0]) return { aliasId: raced[0].alias_id, displayAlias: raced[0].display_alias };

        if (attempt === MAX_DISPLAY_ALIAS_ATTEMPTS - 1) throw err;
      }
    }
    throw new Error("Could not allocate a unique display alias");
  }
}
