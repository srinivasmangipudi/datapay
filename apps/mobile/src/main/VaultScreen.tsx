import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { ConsentCategory, getConsents, setConsent } from "../api";
import type { Session } from "../session";

interface Props {
  session: Session;
}

export function VaultScreen({ session }: Props) {
  const [categories, setCategories] = useState<ConsentCategory[] | null>(null);

  const load = useCallback(async () => {
    setCategories(await getConsents(session.token));
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(categoryId: number, granted: boolean) {
    setCategories((prev) =>
      prev ? prev.map((c) => (c.categoryId === categoryId ? { ...c, granted } : c)) : prev
    );
    await setConsent(session.token, categoryId, granted);
  }

  if (!categories) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.alias}>{session.displayAlias}</Text>
      <Text style={styles.sealNote}>
        Brands only ever see this alias. Identity never shared — every toggle below is instant and
        logged in your audit trail.
      </Text>

      {categories.map((c) => (
        <View key={c.categoryId} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowName}>{c.name}</Text>
            {c.nameKn && <Text style={styles.rowNameKn}>{c.nameKn}</Text>}
          </View>
          <Switch value={c.granted} onValueChange={(v) => toggle(c.categoryId, v)} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20, paddingTop: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  alias: { fontSize: 20, fontWeight: "700" },
  sealNote: { fontSize: 13, color: "#666", marginTop: 8, marginBottom: 24, lineHeight: 19 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowText: { flex: 1, paddingRight: 12 },
  rowName: { fontSize: 15, fontWeight: "600" },
  rowNameKn: { fontSize: 13, color: "#888", marginTop: 2 },
});
