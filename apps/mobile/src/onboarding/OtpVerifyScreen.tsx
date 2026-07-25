import { useRef, useState } from "react";
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
import { verifyOtp, type VerifyOtpResult } from "../api";
import { DataPayMark } from "../brand/DataPayLogo";
import { colors, radii, spacing, type } from "../theme";
import { ProgressDots } from "./ProgressDots";

interface Props {
  phoneE164: string;
  onVerified: (result: VerifyOtpResult) => void;
}

const TOTAL_STEPS = 5;
const OTP_LENGTH = 6;

export function OtpVerifyScreen({ phoneE164, onVerified }: Props) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  async function handleSubmit() {
    setLoading(true);
    try {
      const result = await verifyOtp(phoneE164, otp);
      onVerified(result);
    } catch (err) {
      Alert.alert("Couldn't verify OTP", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ProgressDots step={2} total={TOTAL_STEPS} />

        <View style={styles.logoWrap}>
          <DataPayMark size={40} />
        </View>

        <Text style={styles.title}>Check your messages</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to {phoneE164}</Text>

        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
          <View style={styles.otpWrap}>
            {Array.from({ length: OTP_LENGTH }, (_, i) => (
              <View key={i} style={[styles.box, otp.length === i && styles.boxActive]}>
                <Text style={styles.boxText}>{otp[i] ?? ""}</Text>
              </View>
            ))}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, OTP_LENGTH))}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoFocus
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, otp.length !== OTP_LENGTH && styles.buttonDisabled]}
          disabled={otp.length !== OTP_LENGTH || loading}
          onPress={handleSubmit}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color={colors.onDark} /> : <Text style={styles.buttonText}>Verify</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, padding: spacing.xl, paddingTop: 64, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.lg },
  title: { ...type.title, textAlign: "center", color: colors.ink },
  subtitle: { ...type.body, textAlign: "center", color: colors.subtle, marginTop: spacing.sm, marginBottom: spacing.xxl },
  otpWrap: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, position: "relative" },
  box: {
    width: 44,
    height: 54,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxActive: { borderColor: colors.teal },
  boxText: { fontSize: 22, fontWeight: "700", color: colors.ink },
  hiddenInput: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01 },
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
