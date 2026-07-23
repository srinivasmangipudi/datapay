import { StyleSheet, Text, TextStyle } from "react-native";
import { colors } from "../theme";

interface Props {
  en: string;
  kn?: string;
  size?: number;
  weight?: TextStyle["fontWeight"];
  tone?: "default" | "onDark" | "subtle" | "onDarkSubtle";
  style?: TextStyle;
}

const TONE_COLOR: Record<NonNullable<Props["tone"]>, string> = {
  default: colors.ink,
  onDark: colors.onDark,
  subtle: colors.subtle,
  onDarkSubtle: colors.onDarkSubtle,
};

// Kannada gets equal visual weight to English, stacked below it — not a
// smaller, grayed-out afterthought. This is a bilingual product for a
// bilingual audience; the UI chrome should read that way even before a
// native speaker reviews the copy itself (SPEC.md §19G).
export function Bilingual({ en, kn, size = 15, weight = "600", tone = "default", style }: Props) {
  const color = TONE_COLOR[tone];
  return (
    <>
      <Text style={[{ fontSize: size, fontWeight: weight, color }, style]}>{en}</Text>
      {kn && (
        <Text style={[styles.kn, { fontSize: size - 1, color }, style]} numberOfLines={2}>
          {kn}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  kn: { marginTop: 2, fontWeight: "500" },
});
