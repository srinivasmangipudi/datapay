import { getAuth, signInWithPhoneNumber } from "@react-native-firebase/auth";

export { getAuth, signInWithPhoneNumber };

// No direct type export for this in the installed SDK version — derived
// from the function's own return type instead of guessing an import path.
export type FirebaseConfirmation = Awaited<ReturnType<typeof signInWithPhoneNumber>>;
