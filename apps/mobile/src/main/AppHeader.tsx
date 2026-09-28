import { StyleSheet, Text, View } from "react-native";
import { Bilingual } from "../components/Bilingual";
import { DataPayMark } from "../brand/DataPayLogo";
import { strings } from "../i18n/strings";
import type { Session } from "../session";
import { colors, spacing } from "../theme";

/**
 * The app header, shown on EVERY tab.
 *
 * It used to live inside HomeScreen, so the branding and the member's own
 * username vanished the moment they opened Pulse, Products or Community — the
 * app looked like it had lost its chrome halfway through.
 */
export function AppHeader({ session, topInset }: { session: Session; topInset: number }) {
  return (
    <View style={[styles.header, { paddingTop: topInset + spacing.md }]}>
      <DataPayMark size={24} />
      <Text style={styles.wordmark}>
        Data
        <Text style={styles.wordmarkPay}>Pay</Text>
        <Text style={styles.wordmarkSep}>-</Text>
        <Text style={styles.wordmarkBeta}>Beta</Text>
      </Text>
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
  // Carried over verbatim from HomeScreen. CabinetGrotesk-Extrabold isn't
  // loaded at runtime (nothing calls useFonts), so this falls back to the
  // system face at weight 800 — same as DataPayLogo.
  wordmark: {
    fontFamily: "CabinetGrotesk-Extrabold",
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  // Brand lockup: "Data" in ink, "Pay" in brass.
  wordmarkPay: { color: colors.brass },
  // Muted hyphen so it reads as a separator rather than part of either word.
  wordmarkSep: { color: colors.faint, fontWeight: "700" },
  wordmarkBeta: { color: colors.teal },
  spacer: { flex: 1 },
  identity: { alignItems: "flex-end" },
  identityLabel: { letterSpacing: 0.7, textTransform: "uppercase" },
  alias: { fontSize: 14, color: colors.ink, fontWeight: "700" },
});
