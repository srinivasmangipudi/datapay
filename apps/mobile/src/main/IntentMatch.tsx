import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { Product } from "../api";
import { colors, radii, spacing, type } from "../theme";

/** How a declared window reads back to the person who declared it. */
const WINDOW_LABEL: Record<string, string> = {
  "1m": "in the next month",
  "3m": "in the next 3 months",
  "6m": "in the next 6 months",
  "12m": "this year",
};

/**
 * The reason a product is in front of this member.
 *
 * DataPay's whole bet is that demand is LAZY — a household knows it will need a
 * solar light eventually, and that knowledge never becomes a purchase because
 * nothing connects it to supply at the right moment. Answering a question is
 * where the declaration happens; this is where it comes back.
 *
 * Deliberately NOT framed as a group ("12 households want this"). The
 * collectivisation happens in the data, invisibly, so that a supplier can stop
 * guessing — the member is never asked to be part of a crowd, and never sees a
 * threshold they have to help reach.
 */
export function IntentReason({ product }: { product: Product }) {
  if (!product.matchedIntent) return null;

  const when = WINDOW_LABEL[product.matchedIntent.window] ?? "soon";
  const what = product.categoryName?.toLowerCase() ?? "this";

  return (
    <View style={styles.reason}>
      <Ionicons name="checkmark-circle" size={15} color={colors.teal} />
      <Text style={styles.reasonText}>
        You said you were looking for {what} {when}
      </Text>
    </View>
  );
}

/** Heading for the matched block, with a plain explanation of why it exists. */
export function IntentSectionHeader({ count }: { count: number }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Because you asked</Text>
      <Text style={styles.headerSub}>
        {count === 1 ? "One thing" : `${count} things`} you told us you needed
        {count === 1 ? " is" : " are"} available near you now.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.tealTint,
    borderRadius: radii.sm,
    alignSelf: "flex-start",
  },
  reasonText: { ...type.caption, color: colors.tealDeep, fontWeight: "600", flexShrink: 1 },
  header: { marginBottom: spacing.md },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  headerSub: { ...type.small, color: colors.subtle, marginTop: 2, lineHeight: 19 },
});
