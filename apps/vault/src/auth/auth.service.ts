import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import {
  computeAliasId,
  generateDisplayAliasCandidate,
  generateDisplayAliasCandidates,
  isWellFormedDisplayAlias,
} from "./alias.util";
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  generateOtpCode,
  generateOtpSalt,
  hashOtpCode,
} from "./otp.util";

const ALIAS_CANDIDATE_COUNT = 8;
// A member browsing name options shouldn't have to redo OTP if they take a
// few minutes deciding — but an abandoned session shouldn't squat a pending
// row forever either. 30 minutes is a generous "still mid-signup" window.
const PENDING_SIGNUP_TTL_MS = 30 * 60 * 1000;

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
  ): Promise<
    | { status: "returning"; token: string; aliasId: string; displayAlias: string }
    | { status: "choose_alias"; pendingToken: string; aliasId: string; candidates: string[] }
  > {
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

    const aliasId = computeAliasId(user.id, this.pepper);
    await this.pool.query(
      `INSERT INTO vault_access_log (service, purpose, alias_or_token) VALUES ($1, $2, $3)`,
      ["vault", "verify-otp", aliasId]
    );

    const existing = await this.getExistingAlias(user.id);
    if (existing) {
      // Returning member — same as before this addendum, no name-picking step.
      const token = await this.jwt.signAsync({
        aliasId: existing.aliasId,
        displayAlias: existing.displayAlias,
      });
      return { status: "returning", token, aliasId: existing.aliasId, displayAlias: existing.displayAlias };
    }

    // First-time member (SPEC.md §36): offer candidates, commit nothing yet.
    // Re-verifying replaces any earlier pending session for this user — only
    // one is ever valid at a time.
    const { rows: pendingRows } = await this.pool.query<{ token: string }>(
      `INSERT INTO pending_signups (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET token = gen_random_uuid(), created_at = now()
       RETURNING token`,
      [user.id]
    );
    const candidates = await this.generateUniqueCandidates();
    return { status: "choose_alias", pendingToken: pendingRows[0].token, aliasId, candidates };
  }

  /** SPEC.md §36 — "see various combinations": a fresh batch, same pending session. */
  async regenerateCandidates(pendingToken: string): Promise<{ candidates: string[] }> {
    await this.loadPendingSignup(pendingToken); // validates existence + expiry, discards the row
    return { candidates: await this.generateUniqueCandidates() };
  }

  /** SPEC.md §36 — the member's chosen name becomes real: alias_map is written, JWT is minted. */
  async commitAlias(
    pendingToken: string,
    displayAlias: string
  ): Promise<{ token: string; aliasId: string; displayAlias: string }> {
    if (!isWellFormedDisplayAlias(displayAlias)) {
      throw new BadRequestException("Not a recognized display alias");
    }

    const userId = await this.loadPendingSignup(pendingToken);
    const aliasId = computeAliasId(userId, this.pepper);

    try {
      await this.pool.query(
        `INSERT INTO alias_map (user_id, alias_id, display_alias) VALUES ($1, $2, $3)`,
        [userId, aliasId, displayAlias]
      );
    } catch (err) {
      if ((err as { code?: string }).code !== "23505") throw err;
      // Either this exact user already committed (a retried request —
      // idempotent replay, return what's there) or a different user took
      // this exact name in the last few seconds (rare — the whole point of
      // an 8-candidate batch from a 7,920-combination space, but possible).
      const existing = await this.getExistingAlias(userId);
      if (existing) {
        await this.pool.query(`DELETE FROM pending_signups WHERE token = $1`, [pendingToken]);
        const token = await this.jwt.signAsync({
          aliasId: existing.aliasId,
          displayAlias: existing.displayAlias,
        });
        return { token, aliasId: existing.aliasId, displayAlias: existing.displayAlias };
      }
      throw new ConflictException("That name was just taken — pick another");
    }

    await this.pool.query(`DELETE FROM pending_signups WHERE token = $1`, [pendingToken]);
    const token = await this.jwt.signAsync({ aliasId, displayAlias });
    return { token, aliasId, displayAlias };
  }

  private async loadPendingSignup(pendingToken: string): Promise<string> {
    const { rows } = await this.pool.query<{ user_id: string; created_at: Date }>(
      `SELECT user_id, created_at FROM pending_signups WHERE token = $1`,
      [pendingToken]
    );
    const row = rows[0];
    if (!row) throw new UnauthorizedException("Invalid or already-used signup session");
    if (Date.now() - new Date(row.created_at).getTime() > PENDING_SIGNUP_TTL_MS) {
      await this.pool.query(`DELETE FROM pending_signups WHERE token = $1`, [pendingToken]);
      throw new UnauthorizedException("This signup session expired — verify your phone again");
    }
    return row.user_id;
  }

  private async getExistingAlias(
    userId: string
  ): Promise<{ aliasId: string; displayAlias: string } | null> {
    const { rows } = await this.pool.query<{ alias_id: string; display_alias: string }>(
      `SELECT alias_id, display_alias FROM alias_map WHERE user_id = $1`,
      [userId]
    );
    return rows[0] ? { aliasId: rows[0].alias_id, displayAlias: rows[0].display_alias } : null;
  }

  /** Generates a batch, filters out anything already taken, tops back up if needed. */
  private async generateUniqueCandidates(): Promise<string[]> {
    const batch = generateDisplayAliasCandidates(ALIAS_CANDIDATE_COUNT);
    const { rows: taken } = await this.pool.query<{ display_alias: string }>(
      `SELECT display_alias FROM alias_map WHERE display_alias = ANY($1)`,
      [batch]
    );
    const takenSet = new Set(taken.map((r) => r.display_alias));
    const available = new Set(batch.filter((c) => !takenSet.has(c)));

    // With 7,920 total combinations and an 8-item batch, losing one to a
    // collision is already rare — this just tops the batch back up rather
    // than silently showing the member fewer options than promised.
    while (available.size < ALIAS_CANDIDATE_COUNT) {
      const candidate = generateDisplayAliasCandidate();
      if (!available.has(candidate) && !takenSet.has(candidate)) {
        available.add(candidate);
      }
    }
    return [...available];
  }
}
