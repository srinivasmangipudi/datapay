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
import { requestOtp } from "../api";

interface Props {
  onSent: (phoneE164: string, name: string) => void;
}

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
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to DataPay</Text>
      <Text style={styles.subtitle}>Your phone number stays sealed in the vault — never shared.</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Phone number</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="9876543210"
        keyboardType="phone-pad"
      />

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit || loading}
        onPress={handleSubmit}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 32 },
  label: { fontSize: 13, color: "#444", marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
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
