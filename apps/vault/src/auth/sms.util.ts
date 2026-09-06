const MSG91_OTP_ENDPOINT = "https://control.msg91.com/api/v5/otp";
const SEND_RETRY_DELAY_MS = 1000;

function stripLeadingPlus(phoneE164: string): string {
  return phoneE164.replace(/^\+/, "");
}

async function sendViaMsg91(
  phoneE164: string,
  code: string,
  authKey: string,
  templateId: string
): Promise<void> {
  const url = new URL(MSG91_OTP_ENDPOINT);
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", stripLeadingPlus(phoneE164));
  // Our own code (otp.util.ts), not MSG91's — it only delivers the text;
  // hashing/expiry/attempt-limiting stays exactly as it was before this.
  url.searchParams.set("otp", code);
  url.searchParams.set("otp_length", String(code.length));
  url.searchParams.set("otp_expiry", "5"); // minutes — matches OTP_TTL_MS

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { authkey: authKey },
  });
  const data = (await res.json().catch(() => null)) as { type?: string; message?: string } | null;
  if (!res.ok || data?.type !== "success") {
    throw new Error(data?.message ?? `MSG91 request failed (${res.status})`);
  }
}

/**
 * Real SMS delivery via MSG91 — used purely as the text-message transport
 * for a code we already generated and hashed ourselves (auth.service.ts),
 * never MSG91's own OTP/verify feature. Falls back to a console log when
 * MSG91 isn't configured (local dev, tests) — same as before this addendum.
 */
export async function sendOtpSms(phoneE164: string, code: string): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;

  if (!authKey || !templateId) {
    // eslint-disable-next-line no-console
    console.log(`[vault][dev] OTP for ${phoneE164}: ${code}`);
    return;
  }

  try {
    await sendViaMsg91(phoneE164, code, authKey, templateId);
  } catch {
    // One retry only — rides out a transient blip; a second failure is a
    // real problem the caller should surface, not swallow.
    await new Promise((resolve) => setTimeout(resolve, SEND_RETRY_DELAY_MS));
    await sendViaMsg91(phoneE164, code, authKey, templateId);
  }
}
