import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { requestOtp } from "../api";
import { DataPayLogo } from "../brand/DataPayLogo";
import { colors, radii, spacing, type } from "../theme";
import { ProgressDots } from "./ProgressDots";

interface Props {
  onSent: (phoneE164: string, name: string) => void;
}

const TOTAL_STEPS = 5;

export function PhoneEntryScreen({ onSent }: Props) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const phoneE164 = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "")}`;
  const canSubmit = /^\+[1-9]\d{6,14}$/.test(phoneE164) && name.trim().length > 0;

  async function handleSubmit() {
    setLoading(true);
    try {
      await requestOtp(phoneE164, name.trim());
      onSent(phoneE164, name.trim());
    } catch (err) {
      Alert.alert("Couldn't send OTP", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.blobA} />
      <View style={styles.blobB} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ProgressDots step={1} total={TOTAL_STEPS} />

        <View style={styles.logoWrap}>
          <DataPayLogo size={44} tagline="Your data is your asset" />
        </View>

        <Text style={styles.title}>Let's get your village on the map</Text>
        <Text style={styles.titleKn}>ನಿಮ್ಮ ಊರನ್ನು ನಕ್ಷೆಗೆ ಸೇರಿಸೋಣ</Text>
        <Text style={styles.subtitle}>
          A few questions a day, small rewards, and your household's answers help your community
          get better prices — together.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>What should we call you?</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
          />

          <Text style={[styles.label, { marginTop: spacing.lg }]}>Phone number</Text>
          <View style={styles.phoneRow}>
            <Text style={styles.countryCode}>+91</Text>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              value={phone}
              onChangeText={setPhone}
              placeholder="98765 43210"
              placeholderTextColor={colors.faint}
              keyboardType="phone-pad"
            />
          </View>
          <Text style={styles.hint}>Sealed in the vault — never shared with brands or ops. 🔒</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          disabled={!canSubmit || loading}
          onPress={handleSubmit}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color={colors.onDark} /> : <Text style={styles.buttonText}>Send OTP</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, padding: spacing.xl, paddingTop: 64, paddingBottom: spacing.xxl },
  blobA: {
    position: "absolute",
    top: -60,
    right: -50,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: colors.tealTint,
  },
  blobB: {
    position: "absolute",
    top: 120,
    left: -70,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: colors.brassTint,
  },
  logoWrap: { alignItems: "center", marginTop: spacing.xxl, marginBottom: spacing.lg },
  title: { ...type.title, textAlign: "center", color: colors.ink, marginTop: spacing.md },
  titleKn: { ...type.subtitle, textAlign: "center", color: colors.subtle, marginTop: 4, fontWeight: "600" },
  subtitle: {
    ...type.body,
    textAlign: "center",
    color: colors.subtle,
    marginTop: spacing.md,
    lineHeight: 21,
    paddingHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { ...type.small, color: colors.subtle, marginBottom: spacing.xs, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  countryCode: { ...type.subtitle, color: colors.subtle, fontWeight: "700" },
  phoneInput: { flex: 1 },
  hint: { ...type.caption, color: colors.faint, marginTop: spacing.md },
  button: {
    marginTop: spacing.xxl,
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: colors.tealSoft },
  buttonText: { color: colors.onDark, fontWeight: "700", fontSize: 16 },
});
