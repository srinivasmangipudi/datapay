import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../theme";

interface Props {
  variant?: "surface" | "dark" | "outline";
  style?: ViewStyle;
  children: React.ReactNode;
}

export function Card({ variant = "surface", style, children }: Props) {
  return <View style={[styles.base, VARIANT_STYLE[variant], style]}>{children}</View>;
}

const VARIANT_STYLE: Record<NonNullable<Props["variant"]>, ViewStyle> = {
  surface: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dark: { backgroundColor: colors.ink },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
});
