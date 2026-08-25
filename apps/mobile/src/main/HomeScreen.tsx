import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPulseToday, getTokens, TokensSummary } from "../api";
import { Bilingual } from "../components/Bilingual";
import { Card } from "../components/Card";
import { DataPayMark } from "../brand/DataPayLogo";
import { strings } from "../i18n/strings";
import type { Session } from "../session";
import { colors, spacing, type } from "../theme";

interface Props {
  session: Session;
  onNavigate: (tab: "pulse") => void;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function HomeScreen({ session, onNavigate }: Props) {
  const [tokens, setTokens] = useState<TokensSummary | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const [tokenSummary, pulseToday] = await Promise.all([
      getTokens(session.token),
      getPulseToday(session.token),
    ]);
    setTokens(tokenSummary);
    setPendingCount(pulseToday.length);
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load().finally(() => setRefreshing(false));
  }

  if (!tokens) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
    >
      <View style={styles.header}>
        <DataPayMark size={22} />
        <Text style={styles.greeting}>{session.displayAlias}</Text>
      </View>

      <Card variant="dark" style={styles.balanceCard}>
        <Bilingual {...strings.home.yourTokens} tone="onDarkSubtle" size={11.5} weight="700" style={type.label as any} />
        {/* TOKEN_ECONOMY_REDESIGN.md — every token is equal, one number */}
        <Text style={styles.balance}>◈ {tokens.balance}</Text>
      </Card>

      <TouchableOpacity activeOpacity={0.85} onPress={() => onNavigate("pulse")}>
        <Card style={styles.pulseCard}>
          <View style={{ flex: 1 }}>
            <Bilingual {...strings.home.todaysPulse} size={11.5} weight="700" tone="subtle" style={type.label as any} />
            <Text style={styles.pending}>
              {pendingCount > 0
                ? `${pendingCount} ${pendingCount === 1 ? strings.home.pendingOne.en : strings.home.pendingMany.en}`
                : strings.home.allDone.en}
            </Text>
            <Text style={styles.pendingKn}>
              {pendingCount > 0
                ? `${pendingCount} ${pendingCount === 1 ? strings.home.pendingOne.kn : strings.home.pendingMany.kn}`
                : strings.home.allDone.kn}
            </Text>
          </View>
          {pendingCount > 0 && <Text style={styles.chevron}>›</Text>}
        </Card>
      </TouchableOpacity>

      <Card variant="outline">
        <Bilingual {...strings.home.recentActivity} size={11.5} weight="700" tone="subtle" style={type.label as any} />
        <View style={{ marginTop: spacing.md }}>
          {tokens.history.slice(0, 5).map((h, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.rowMain}>
                <Bilingual en={h.label} kn={h.labelKn} size={13} weight="500" />
                <Text style={styles.rowWhen}>{formatRelativeTime(h.createdAt)}</Text>
              </View>
              <Text style={[styles.rowValue, h.tokens < 0 && styles.rowValueNegative]}>
                {h.tokens > 0 ? "+" : ""}
                {h.tokens} ◈
              </Text>
            </View>
          ))}
          {tokens.history.length === 0 && (
            <Bilingual {...strings.home.emptyActivity} size={13} weight="500" tone="subtle" />
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: spacing.lg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.paper },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.base },
  greeting: { fontSize: 13, color: colors.faint, fontWeight: "500" },
  balanceCard: { marginBottom: spacing.md },
  balance: { color: colors.brassOnDark, fontSize: 34, fontWeight: "700", marginTop: spacing.sm },
  pulseCard: {
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pending: { fontSize: 18, fontWeight: "700", marginTop: spacing.sm, color: colors.ink },
  pendingKn: { fontSize: 14, fontWeight: "500", marginTop: 2, color: colors.subtle },
  chevron: { fontSize: 26, color: colors.faint, fontWeight: "300", marginLeft: spacing.sm },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: { flex: 1, marginRight: spacing.md },
  rowWhen: { fontSize: 11, color: colors.faint, marginTop: 2 },
  rowValue: { fontSize: 13, fontWeight: "700", color: colors.teal, marginTop: 1 },
  rowValueNegative: { color: colors.danger },
});
