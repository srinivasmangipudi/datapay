import { Logger } from "@nestjs/common";
import { google } from "googleapis";

export interface PushMessage {
  title: string;
  body: string;
}

export interface PushResult {
  ok: boolean;
  /** FCM says this token is dead — the app was uninstalled, or the token
      rotated. The caller deletes it rather than retrying forever. */
  unregistered?: boolean;
  error?: string;
}

export interface PushSender {
  send(token: string, message: PushMessage): Promise<PushResult>;
}

/**
 * Used until FIREBASE_SERVICE_ACCOUNT_KEY is configured. Logs and reports
 * success WITHOUT sending, which is safe only because the caller's counts are
 * the only thing downstream of it — nothing credits tokens or changes member
 * state on a send. Mirrors DevSandboxUpiProvider.
 *
 * It says so loudly at construction: a deployment silently not notifying
 * anyone, while reporting that it did, is exactly the kind of thing that goes
 * unnoticed for months.
 */
export class DevNoopPushSender implements PushSender {
  private readonly logger = new Logger(DevNoopPushSender.name);

  constructor() {
    this.logger.warn(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set — push notifications are STUBBED. " +
        "Nudges will be computed and counted but no device will receive anything."
    );
  }

  async send(token: string, message: PushMessage): Promise<PushResult> {
    this.logger.debug(`[stub] would push "${message.title}" to ${token.slice(0, 12)}…`);
    return { ok: true };
  }
}

/**
 * Real FCM over the HTTP v1 API. Deliberately not the deprecated legacy
 * server-key endpoint, which Google has been switching off.
 *
 * Mints its access token through `googleapis` — already a direct dependency,
 * used the same way by drive.provider.ts — rather than adding firebase-admin
 * for a single POST. (google-auth-library is present in the store but only as
 * a transitive dep, so importing it directly would fail under pnpm's strict
 * resolution at runtime, which is exactly the kind of thing that only shows up
 * in production.)
 */
export class FcmPushSender implements PushSender {
  private readonly logger = new Logger(FcmPushSender.name);
  private readonly projectId: string;
  private readonly credentials: { client_email: string; private_key: string };
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(serviceAccountJson: string) {
    const parsed = JSON.parse(serviceAccountJson) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is missing project_id/client_email/private_key"
      );
    }
    this.projectId = parsed.project_id;
    this.credentials = { client_email: parsed.client_email, private_key: parsed.private_key };
  }

  private async accessToken(): Promise<string> {
    // Cached with a minute of headroom — a nudge run sends hundreds of
    // messages and must not re-authorize for each one.
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.value;
    }
    const jwt = new google.auth.JWT({
      email: this.credentials.client_email,
      key: this.credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
    const { access_token, expiry_date } = await jwt.authorize();
    if (!access_token) throw new Error("Could not mint an FCM access token");
    this.cachedToken = { value: access_token, expiresAt: expiry_date ?? Date.now() + 3_000_000 };
    return access_token;
  }

  async send(token: string, message: PushMessage): Promise<PushResult> {
    try {
      const accessToken = await this.accessToken();
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              android: { priority: "normal" },
            },
          }),
        }
      );

      if (res.ok) return { ok: true };

      const detail = (await res.json().catch(() => ({}))) as {
        error?: { status?: string; message?: string };
      };
      // UNREGISTERED / INVALID_ARGUMENT on the token itself means the device is
      // gone. 404 is FCM's canonical "this token no longer exists".
      const status = detail.error?.status ?? "";
      const unregistered = res.status === 404 || status === "UNREGISTERED" || status === "NOT_FOUND";
      return { ok: false, unregistered, error: detail.error?.message ?? `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}

export function resolvePushSender(): PushSender {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!key) return new DevNoopPushSender();
  try {
    return new FcmPushSender(key);
  } catch (err) {
    // A malformed key must not take the whole API down at boot — but it must
    // be impossible to miss in the logs.
    new Logger("resolvePushSender").error(
      `FIREBASE_SERVICE_ACCOUNT_KEY is set but unusable (${(err as Error).message}) — falling back to the stub sender.`
    );
    return new DevNoopPushSender();
  }
}
