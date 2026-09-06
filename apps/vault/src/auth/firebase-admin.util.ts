import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getFirebaseAuth() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return getAuth();
}

/**
 * Verifies a Firebase Phone Auth ID token server-side — the `phone_number`
 * claim only appears on a token Firebase itself confirmed via SMS, so a
 * valid, non-expired token here IS proof of phone ownership. Replaces our
 * own OTP hash check (otp.util.ts) for members who signed in this way;
 * the older register()/verifyOtp() path stays intact alongside this one.
 */
export async function verifyFirebasePhoneToken(idToken: string): Promise<{ phoneE164: string }> {
  const decoded = await getFirebaseAuth().verifyIdToken(idToken);
  if (!decoded.phone_number) {
    throw new Error("Firebase token has no verified phone number");
  }
  return { phoneE164: decoded.phone_number };
}
