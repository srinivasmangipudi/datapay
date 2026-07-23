import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { completeOnboarding } from "../api";
import type { Zone } from "../api";

interface Props {
  token: string;
  displayAlias: string;
  zone: Zone;
  onDone: () => void;
}

const GUARANTEES = [
  "No name. No phone. No address. Brands only ever see this alias.",
  "Every category has an off switch — you decide what's shared, any time.",
  "Deliveries pass through a relay. Identity never crosses the seal.",
];

export function AliasRevealScreen({ token, displayAlias, zone, onDone }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setLoading(true);
    try {
      await completeOnboarding(token, zone.id, "kn");
      onDone();
    } catch (err) {
      Alert.alert("Couldn't finish onboarding", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cap}>Your sealed identity</Text>
        <Text style={styles.alias}>{displayAlias}</Text>
        <Text style={styles.zone}>{zone.name}</Text>
      </View>

      {GUARANTEES.map((g) => (
        <View key={g} style={styles.guaranteeRow}>
          <Text style={styles.check}>✓</Text>
          <Text style={styles.guaranteeText}>{g}</Text>
        </View>
      ))}

      <TouchableOpacity style={styles.button} disabled={loading} onPress={handleContinue}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#fff" },
  card: {
    backgroundColor: "#101418",
    borderRadius: 20,
    padding: 28,
    marginBottom: 32,
  },
  cap: { color: "#8A939B", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  alias: { color: "#F6F5F1", fontSize: 22, fontWeight: "700", marginTop: 10, letterSpacing: 1 },
  zone: { color: "#8A939B", fontSize: 13, marginTop: 8 },
  guaranteeRow: { flexDirection: "row", gap: 10, marginBottom: 16, alignItems: "flex-start" },
  check: { color: "#0E7A5C", fontWeight: "700", fontSize: 15 },
  guaranteeText: { flex: 1, fontSize: 14, color: "#333", lineHeight: 20 },
  button: {
    marginTop: 16,
    backgroundColor: "#0E7A5C",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
