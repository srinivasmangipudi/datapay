import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { verifyOtp, type VerifyOtpResult } from "../api";

interface Props {
  phoneE164: string;
  onVerified: (result: VerifyOtpResult) => void;
}

export function OtpVerifyScreen({ phoneE164, onVerified }: Props) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

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
    <View style={styles.container}>
      <Text style={styles.title}>Enter the code</Text>
      <Text style={styles.subtitle}>Sent to {phoneE164}</Text>

      <TextInput
        style={styles.input}
        value={otp}
        onChangeText={setOtp}
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={6}
      />

      <TouchableOpacity
        style={[styles.button, otp.length !== 6 && styles.buttonDisabled]}
        disabled={otp.length !== 6 || loading}
        onPress={handleSubmit}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: "center",
  },
  button: {
    marginTop: 32,
    backgroundColor: "#0E7A5C",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#B7D9CD" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
