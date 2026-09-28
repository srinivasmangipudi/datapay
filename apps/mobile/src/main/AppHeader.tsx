import { StyleSheet, Text, View } from "react-native";
import { Bilingual } from "../components/Bilingual";
import { DataPayLogo } from "../brand/DataPayLogo";
import { strings } from "../i18n/strings";
import type { Session } from "../session";
import { colors, spacing } from "../theme";

/**
 * The app header, shown on EVERY tab.
 *
 * It used to live inside HomeScreen, so the branding and the member's own
 * username vanished the moment they opened Pulse, Products or Community — the
 * app looked like it had lost its chrome halfway through.
 *
 * The wordmark comes from DataPayLogo rather than being rebuilt here. Hand-
 * rolling it is exactly how this screen ended up rendering "DataPay" flat
 * while every other surface leans "Pay" by -9° — the brand looked different
 * depending on which screen you happened to be on.
 */
export function AppHeader({ session, topInset }: { session: Session; topInset: number }) {
  return (
    <View style={[styles.header, { paddingTop: topInset + spacing.md }]}>
      <DataPayLogo size={26} beta />
      <View style={styles.spacer} />
      {/* Labelled and bold. It was faint 13px with nothing naming it, so a
          member had no way to tell their own alias from decoration — and this
          IS their identity here, the only name a brand will ever see. */}
      <View style={styles.identity}>
        <Bilingual
          {...strings.home.username}
          size={9.5}
          weight="700"
          tone="subtle"
          style={styles.identityLabel as any}
        />
        <Text style={styles.alias}>{session.displayAlias}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.paper,
  },
  spacer: { flex: 1 },
  identity: { alignItems: "flex-end" },
  identityLabel: { letterSpacing: 0.7, textTransform: "uppercase" },
  alias: { fontSize: 14, color: colors.ink, fontWeight: "700" },
});
