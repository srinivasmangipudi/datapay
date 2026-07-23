import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { strings } from "../i18n/strings";
import type { Session } from "../session";
import { colors, spacing } from "../theme";
import { CommunityScreen } from "./CommunityScreen";
import { HomeScreen } from "./HomeScreen";
import { PulseScreen } from "./PulseScreen";
import { SnapScreen } from "./SnapScreen";
import { VaultScreen } from "./VaultScreen";

interface Props {
  session: Session;
}

const TABS = [
  { key: "home", ...strings.tabs.home, icon: "home" },
  { key: "pulse", ...strings.tabs.pulse, icon: "pulse" },
  { key: "snap", ...strings.tabs.snap, icon: "camera" },
  { key: "community", ...strings.tabs.community, icon: "people" },
  { key: "vault", ...strings.tabs.vault, icon: "shield-checkmark" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function MainApp({ session }: Props) {
  const [tab, setTab] = useState<TabKey>("home");
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.screen}>
        {tab === "home" && <HomeScreen session={session} onNavigate={setTab} />}
        {tab === "pulse" && <PulseScreen session={session} />}
        {tab === "snap" && <SnapScreen session={session} />}
        {tab === "community" && <CommunityScreen session={session} />}
        {tab === "vault" && <VaultScreen session={session} />}
      </View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tabItem}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.en}
            >
              <Ionicons
                name={active ? (t.icon as any) : (`${t.icon}-outline` as any)}
                size={22}
                color={active ? colors.teal : colors.faint}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.en}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm + 2,
    backgroundColor: colors.surface,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 3 },
  tabLabel: { fontSize: 11, color: colors.faint, fontWeight: "600" },
  tabLabelActive: { color: colors.teal, fontWeight: "700" },
});
