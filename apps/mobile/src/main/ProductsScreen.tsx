import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bilingual } from "../components/Bilingual";
import { Card } from "../components/Card";
import { strings } from "../i18n/strings";
import { colors, spacing, type } from "../theme";

// TOKEN_ECONOMY_REDESIGN.md's "buy something through the platform" side
// doesn't exist as a real, direct purchase flow yet (collective-buy Offers
// are the only working path today) — this is an honest placeholder, not a
// feature pretending to be finished.
export function ProductsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Bilingual {...strings.products.heading} size={22} weight="700" style={styles.heading as any} />
      <Card variant="outline" style={styles.card}>
        <Ionicons name="storefront-outline" size={32} color={colors.teal} />
        <Bilingual
          {...strings.products.comingSoon}
          size={11.5}
          weight="700"
          tone="subtle"
          style={[type.label, styles.comingSoon] as any}
        />
        <Bilingual {...strings.products.label} size={15} weight="500" style={styles.label as any} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: spacing.lg },
  heading: { marginBottom: spacing.lg, color: colors.ink },
  card: { alignItems: "flex-start", gap: spacing.sm },
  comingSoon: { marginTop: spacing.sm },
  label: { color: colors.ink, lineHeight: 21 },
});
