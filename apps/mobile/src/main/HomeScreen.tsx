import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { getPulseToday, getTokens, TokensSummary } from "../api";
import type { Session } from "../session";

interface Props {
  session: Session;
}

export function HomeScreen({ session }: Props) {
  const [tokens, setTokens] = useState<TokensSummary | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

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
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting}>{session.displayAlias}</Text>

      <View style={styles.balanceCard}>
        <Text style={styles.cap}>Your tokens</Text>
        <Text style={styles.balance}>◈ {tokens.balance}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cap}>Today's Pulse</Text>
        <Text style={styles.pending}>{pendingCount} question{pendingCount === 1 ? "" : "s"} waiting</Text>
      </View>

      <View style={styles.mini}>
        <Text style={styles.cap}>Recent activity</Text>
        {tokens.history.slice(0, 5).map((h, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowLabel}>{h.entry.replace("_", " ")}</Text>
            <Text style={styles.rowValue}>{h.tokens > 0 ? "+" : ""}{h.tokens} ◈</Text>
          </View>
        ))}
        {tokens.history.length === 0 && <Text style={styles.empty}>Nothing yet — answer today's Pulse.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  greeting: { fontSize: 13, color: "#8A939B", marginBottom: 16, marginTop: 8 },
  balanceCard: { backgroundColor: "#101418", borderRadius: 18, padding: 22, marginBottom: 14 },
  cap: { color: "#8A939B", fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase" },
  balance: { color: "#D4AA45", fontSize: 32, fontWeight: "700", marginTop: 8 },
  card: { backgroundColor: "#F6F5F1", borderRadius: 18, padding: 20, marginBottom: 14 },
  pending: { fontSize: 18, fontWeight: "600", marginTop: 8, color: "#101418" },
  mini: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee", borderRadius: 18, padding: 20 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  rowLabel: { fontSize: 13, color: "#444", textTransform: "capitalize" },
  rowValue: { fontSize: 13, fontWeight: "600", color: "#0E7A5C" },
  empty: { fontSize: 13, color: "#999", marginTop: 8 },
});
