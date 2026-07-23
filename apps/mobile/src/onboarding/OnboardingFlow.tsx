import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import type { VerifyOtpResult, Zone } from "../api";
import { MainApp } from "../main/MainApp";
import { loadSession, saveSession, Session } from "../session";
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
  | { name: "done"; session: Session };

const LOCALE = "kn";

// Consent toggles now live in the Vault tab (Phase 2) — deferred no longer,
// `categories` exists once the Question Feeder Engine's migration lands.
export function OnboardingFlow() {
  const [step, setStep] = useState<Step>({ name: "loading" });

  useEffect(() => {
    loadSession().then((session) => {
      setStep(session ? { name: "done", session } : { name: "phone" });
    });
  }, []);

  switch (step.name) {
    case "loading":
      return (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      );
    case "phone":
      return <PhoneEntryScreen onSent={(phoneE164) => setStep({ name: "otp", phoneE164 })} />;
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
            const session: Session = {
              token: step.auth.token,
              aliasId: step.auth.aliasId,
              displayAlias: step.auth.displayAlias,
              zoneId: step.zone.id,
              locale: LOCALE,
            };
            await saveSession(session);
            setStep({ name: "done", session });
          }}
        />
      );
    case "done":
      return <MainApp session={step.session} />;
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
});
