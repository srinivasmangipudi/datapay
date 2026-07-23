import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { VerifyOtpResult, Zone } from "../api";
import { loadSession, saveSession } from "../session";
import { AliasRevealScreen } from "./AliasRevealScreen";
import { OtpVerifyScreen } from "./OtpVerifyScreen";
import { PhoneEntryScreen } from "./PhoneEntryScreen";
import { ZonePickerScreen } from "./ZonePickerScreen";

type Step =
  | { name: "loading" }
  | { name: "phone" }
  | { name: "otp"; phoneE164: string }
  | { name: "zone"; auth: VerifyOtpResult }
  | { name: "reveal"; auth: VerifyOtpResult; zone: Zone }
  | { name: "done" };

// Consent toggles (SPEC.md §8 step 1) are deferred to Phase 2 — they depend on
// `categories`, which the Question Feeder Engine hasn't created yet.
export function OnboardingFlow() {
  const [step, setStep] = useState<Step>({ name: "loading" });

  useEffect(() => {
    loadSession().then((session) => {
      setStep(session ? { name: "done" } : { name: "phone" });
    });
  }, []);

  switch (step.name) {
    case "loading":
      return (
        <View style={styles.done}>
          <ActivityIndicator />
        </View>
      );
    case "phone":
      return (
        <PhoneEntryScreen
          onSent={(phoneE164) => setStep({ name: "otp", phoneE164 })}
        />
      );
    case "otp":
      return (
        <OtpVerifyScreen
          phoneE164={step.phoneE164}
          onVerified={(auth) => setStep({ name: "zone", auth })}
        />
      );
    case "zone":
      return (
        <ZonePickerScreen onSelected={(zone) => setStep({ name: "reveal", auth: step.auth, zone })} />
      );
    case "reveal":
      return (
        <AliasRevealScreen
          token={step.auth.token}
          displayAlias={step.auth.displayAlias}
          zone={step.zone}
          onDone={async () => {
            await saveSession({
              token: step.auth.token,
              aliasId: step.auth.aliasId,
              displayAlias: step.auth.displayAlias,
              zoneId: step.zone.id,
            });
            setStep({ name: "done" });
          }}
        />
      );
    case "done":
      return (
        <View style={styles.done}>
          <Text style={styles.doneTitle}>You're in.</Text>
          <Text style={styles.doneSubtitle}>Home, Pulse, and Snap land in Phase 2.</Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  done: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  doneTitle: { fontSize: 24, fontWeight: "700" },
  doneSubtitle: { fontSize: 14, color: "#666", marginTop: 8 },
});
