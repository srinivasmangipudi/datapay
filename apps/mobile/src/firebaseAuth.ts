import { getAuth, signInWithPhoneNumber } from "@react-native-firebase/auth";

// Every signing certificate that builds this app (release keystore, each
// developer's local debug.keystore, CI's own debug signing, ...) needs its
// SHA-1/SHA-256 registered in the Firebase console, or a build signed with
// it gets the SMS sent fine but has confirmation.confirm(code) reject even
// the correct code (Play Integrity silently fails the attestation check for
// an unrecognized cert). See SPEC.md §44 before assuming this code is broken.
export { getAuth, signInWithPhoneNumber };

// No direct type export for this in the installed SDK version — derived
// from the function's own return type instead of guessing an import path.
export type FirebaseConfirmation = Awaited<ReturnType<typeof signInWithPhoneNumber>>;
