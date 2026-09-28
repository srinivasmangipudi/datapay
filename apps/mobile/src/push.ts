import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onTokenRefresh,
  requestPermission,
} from "@react-native-firebase/messaging";
import { Platform } from "react-native";
import { registerPushToken } from "./api";

// Modular API, same style as firebaseAuth.ts — v26 dropped the namespaced
// `messaging().foo()` default export entirely.

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
    // Android 13+ shows a runtime prompt; below that this resolves
    // immediately. iOS always prompts. Declining is a normal outcome.
    const status = await requestPermission(getMessaging());
    const granted =
      status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
    if (!granted) return;

    const token = await getToken(getMessaging());
    if (!token) return;

    await registerPushToken(sessionToken, token, Platform.OS === "ios" ? "ios" : "android");
  } catch {
    // Silent: a failed registration costs the member a nudge, nothing more.
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
