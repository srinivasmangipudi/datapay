import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onTokenRefresh,
  requestPermission,
} from "@react-native-firebase/messaging";
import { PermissionsAndroid, Platform } from "react-native";
import { registerPushToken } from "./api";

// Modular API, same style as firebaseAuth.ts — v26 dropped the namespaced
// `messaging().foo()` default export entirely.

/**
 * Asks for permission to post notifications, per platform.
 *
 * Firebase's own requestPermission() is an iOS API. On Android it resolves
 * AUTHORIZED without ever showing a prompt, so relying on it meant the app
 * silently skipped straight to getToken() and the member was never asked —
 * POST_NOTIFICATIONS stayed denied and no notification could ever arrive.
 *
 * Android 13 (API 33) introduced the runtime prompt; below that, notifications
 * are granted at install time and there is nothing to ask.
 */
async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    if (Number(Platform.Version) < 33) return true;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    console.log("[push] POST_NOTIFICATIONS ->", result);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  const status = await requestPermission(getMessaging());
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

/**
 * Registers this device for the morning Pulse nudge.
 *
 * Everything here is best-effort and silent on failure: a member who declines
 * notifications, or whose device can't reach FCM, must still get a completely
 * working app. Nothing downstream depends on a token existing.
 *
 * The token goes to Vault through a Core proxy — Core never stores it, exactly
 * like a phone number or a delivery address.
 */
export async function registerForPushNotifications(sessionToken: string): Promise<void> {
  try {
    // Declining is a normal outcome, not an error.
    if (!(await ensurePermission())) return;

    const token = await getToken(getMessaging());
    if (!token) return;

    await registerPushToken(sessionToken, token, Platform.OS === "ios" ? "ios" : "android");
    console.log("[push] registered", token.slice(0, 16), "…");
  } catch (err) {
    // Still non-fatal — a failed registration costs the member a nudge and
    // nothing else — but no longer INVISIBLE. Swallowing this silently meant a
    // device that never registered looked identical to one that had, from both
    // the app and the server.
    console.warn("[push] registration failed:", (err as Error)?.message ?? err);
  }
}

/**
 * FCM rotates tokens on its own schedule — reinstalls, restores, cleared app
 * data. Without this the stored token goes stale and the member quietly stops
 * being notified, which is invisible from both ends.
 *
 * Returns the unsubscribe so the caller can tear it down.
 */
export function watchForTokenRefresh(sessionToken: string): () => void {
  return onTokenRefresh(getMessaging(), (token: string) => {
    registerPushToken(sessionToken, token, Platform.OS === "ios" ? "ios" : "android").catch(
      () => undefined
    );
  });
}
