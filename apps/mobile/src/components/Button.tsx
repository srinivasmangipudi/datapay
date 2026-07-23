import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../theme";

interface Props {
  label: string;
  labelKn?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "danger";
  style?: ViewStyle;
}

export function Button({
  label,
  labelKn,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}: Props) {
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === "primary" ? styles.primary : styles.danger,
        inactive && styles.disabled,
        style,
      ]}
      disabled={inactive}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={colors.onDark} />
      ) : (
        <>
          <Text style={styles.label}>{label}</Text>
          {labelKn && <Text style={styles.labelKn}>{labelKn}</Text>}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.teal },
  danger: { backgroundColor: colors.danger },
  disabled: { backgroundColor: colors.tealSoft },
  label: { color: colors.onDark, fontWeight: "700", fontSize: 16 },
  labelKn: { color: colors.onDarkSubtle, fontWeight: "600", fontSize: 13, marginTop: 2 },
});
