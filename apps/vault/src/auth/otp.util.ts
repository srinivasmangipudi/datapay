import { createHash, randomBytes, randomInt } from "crypto";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function generateOtpSalt(): string {
  return randomBytes(16).toString("hex");
}
