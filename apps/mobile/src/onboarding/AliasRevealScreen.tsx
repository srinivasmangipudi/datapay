import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { completeOnboarding } from "../api";
import type { Zone } from "../api";
import { DataPayMark } from "../brand/DataPayLogo";
import { colors, radii, spacing, type } from "../theme";
import { ProgressDots } from "./ProgressDots";

interface Props {
  token: string;
  displayAlias: string;
  zone: Zone;
  zoneMeta?: { zoneConfirmed: boolean; requestedAreaNote?: string };
  onDone: () => void;
}

const GUARANTEES = [
  "No name. No phone. No address. Brands only ever see this alias.",
  "Every category has an off switch — you decide what's shared, any time.",
  "Deliveries pass through a relay. Identity never crosses the seal.",
];

const TOTAL_STEPS = 5;

export function AliasRevealScreen({ token, displayAlias, zone, zoneMeta, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  async function handleContinue() {
    setLoading(true);
    try {
      await completeOnboarding(token, zone.id, "kn", zoneMeta);
      onDone();
    } catch (err) {
      Alert.alert("Couldn't finish onboarding", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}>
      <ProgressDots step={5} total={TOTAL_STEPS} />

      <Text style={styles.title}>You're all set 🎉</Text>
      <Text style={styles.subtitle}>Here's your profile — this is what DataPay and every brand will ever see.</Text>

      <View style={styles.card}>
        <DataPayMark size={26} dark />
        <Text style={styles.cap}>Your public name</Text>
        <Text style={styles.alias}>{displayAlias}</Text>
        <View style={styles.zoneRow}>
          <Text style={styles.zone}>{zone.name}</Text>
          {zoneMeta && !zoneMeta.zoneConfirmed && (
            <Text style={styles.zoneNote}>Closest match for now — we'll refine this as we add your area.</Text>
          )}
        </View>
      </View>

      {GUARANTEES.map((g) => (
        <View key={g} style={styles.guaranteeRow}>
          <Text style={styles.check}>✓</Text>
          <Text style={styles.guaranteeText}>{g}</Text>
        </View>
      ))}

      <TouchableOpacity style={styles.button} disabled={loading} onPress={handleContinue} activeOpacity={0.85}>
        {loading ? <ActivityIndicator color={colors.onDark} /> : <Text style={styles.buttonText}>Start earning</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, paddingTop: 64, justifyContent: "center", backgroundColor: colors.paper },
  title: { ...type.title, textAlign: "center", color: colors.ink, marginTop: spacing.xl },
  subtitle: {
    ...type.body,
    textAlign: "center",
    color: colors.subtle,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  cap: { color: colors.mist, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginTop: spacing.base },
  alias: { color: colors.onDark, fontSize: 22, fontWeight: "700", marginTop: 10, letterSpacing: 0.5 },
  zoneRow: { marginTop: spacing.sm },
  zone: { color: colors.mist, fontSize: 13 },
  zoneNote: { color: colors.brassOnDark, fontSize: 11.5, marginTop: 4, lineHeight: 16 },
  guaranteeRow: { flexDirection: "row", gap: 10, marginBottom: spacing.base, alignItems: "flex-start" },
  check: { color: colors.teal, fontWeight: "700", fontSize: 15 },
  guaranteeText: { flex: 1, fontSize: 14, color: colors.subtle, lineHeight: 20 },
  button: {
    marginTop: spacing.base,
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: colors.onDark, fontWeight: "700", fontSize: 16 },
});
