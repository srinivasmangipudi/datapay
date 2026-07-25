import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import type { Zone } from "../api";
import { MainApp } from "../main/MainApp";
import { clearSession, loadSession, saveSession, Session } from "../session";
import { AliasRevealScreen } from "./AliasRevealScreen";
import { ChooseAliasScreen } from "./ChooseAliasScreen";
import { OtpVerifyScreen } from "./OtpVerifyScreen";
import { PhoneEntryScreen } from "./PhoneEntryScreen";
import { ZonePickerScreen } from "./ZonePickerScreen";

// Once an alias exists — either a returning member's, or a first-time
// member's freshly committed pick (SPEC.md §36) — this is all downstream
// steps need; they don't care which path got them here.
interface CommittedAuth {
  token: string;
  aliasId: string;
  displayAlias: string;
}

// SPEC.md §38 — set when the zone came from the "my area isn't listed"
// fallback rather than a real pick; carried through to completeOnboarding.
interface ZoneMeta {
  zoneConfirmed: boolean;
  requestedAreaNote?: string;
}

type Step =
  | { name: "loading" }
  | { name: "phone" }
  | { name: "otp"; phoneE164: string }
  | { name: "chooseAlias"; pendingToken: string; candidates: string[] }
  | { name: "zone"; auth: CommittedAuth }
  | { name: "reveal"; auth: CommittedAuth; zone: Zone; zoneMeta?: ZoneMeta }
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
          onVerified={(result) => {
            if (result.status === "returning") {
              setStep({
                name: "zone",
                auth: { token: result.token, aliasId: result.aliasId, displayAlias: result.displayAlias },
              });
            } else {
              setStep({ name: "chooseAlias", pendingToken: result.pendingToken, candidates: result.candidates });
            }
          }}
        />
      );
    case "chooseAlias":
      return (
        <ChooseAliasScreen
          pendingToken={step.pendingToken}
          candidates={step.candidates}
          onChosen={(auth) => setStep({ name: "zone", auth })}
        />
      );
    case "zone":
      return (
        <ZonePickerScreen
          token={step.auth.token}
          onSelected={(zone, meta) => setStep({ name: "reveal", auth: step.auth, zone, zoneMeta: meta })}
        />
      );
    case "reveal":
      return (
        <AliasRevealScreen
          token={step.auth.token}
          displayAlias={step.auth.displayAlias}
          zone={step.zone}
          zoneMeta={step.zoneMeta}
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
      return (
        <MainApp
          session={step.session}
          onLogout={async () => {
            await clearSession();
            setStep({ name: "phone" });
          }}
        />
      );
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
});
