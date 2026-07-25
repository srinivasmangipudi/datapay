import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

interface Props {
  step: number; // 1-based
  total: number;
}

export function ProgressDots({ step, total }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i < step && styles.dotDone, i === step - 1 && styles.dotCurrent]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, justifyContent: "center" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotDone: { backgroundColor: colors.tealSoft },
  dotCurrent: { backgroundColor: colors.teal, width: 20 },
});
