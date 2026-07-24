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
import { DataPayMark } from "../brand/DataPayLogo";
import { colors } from "../theme";

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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoRow}>
          <DataPayMark size={40} />
        </View>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, padding: 24, justifyContent: "center", backgroundColor: colors.paper },
  logoRow: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8, color: colors.ink },
  subtitle: { fontSize: 14, color: colors.subtle, marginBottom: 32 },
  label: { fontSize: 13, color: colors.subtle, marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  button: {
    marginTop: 32,
    backgroundColor: colors.teal,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: colors.tealSoft },
  buttonText: { color: colors.onDark, fontWeight: "600", fontSize: 16 },
});
