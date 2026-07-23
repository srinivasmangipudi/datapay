import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Session } from "../session";
import { CommunityScreen } from "./CommunityScreen";
import { HomeScreen } from "./HomeScreen";
import { PulseScreen } from "./PulseScreen";
import { SnapScreen } from "./SnapScreen";
import { VaultScreen } from "./VaultScreen";

interface Props {
  session: Session;
}

const TABS = [
  { key: "home", label: "Home" },
  { key: "pulse", label: "Pulse" },
  { key: "snap", label: "Snap" },
  { key: "community", label: "Community" },
  { key: "vault", label: "Vault" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function MainApp({ session }: Props) {
  const [tab, setTab] = useState<TabKey>("home");

  return (
    <View style={styles.container}>
      <View style={styles.screen}>
        {tab === "home" && <HomeScreen session={session} />}
        {tab === "pulse" && <PulseScreen session={session} />}
        {tab === "snap" && <SnapScreen session={session} />}
        {tab === "community" && <CommunityScreen session={session} />}
        {tab === "vault" && <VaultScreen session={session} />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingBottom: 24,
    paddingTop: 10,
  },
  tabItem: { flex: 1, alignItems: "center" },
  tabLabel: { fontSize: 12, color: "#999", fontWeight: "500" },
  tabLabelActive: { color: "#0E7A5C", fontWeight: "700" },
});
