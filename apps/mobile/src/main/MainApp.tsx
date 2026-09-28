import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { strings } from "../i18n/strings";
import { registerForPushNotifications, watchForTokenRefresh } from "../push";
import type { Session } from "../session";
import { colors, spacing } from "../theme";
import { AppHeader } from "./AppHeader";
import { CommunityScreen } from "./CommunityScreen";
import { HomeScreen } from "./HomeScreen";
import { ProductsScreen } from "./ProductsScreen";
import { PulseScreen } from "./PulseScreen";
import { VaultScreen } from "./VaultScreen";

interface Props {
  session: Session;
  onLogout: () => void;
}

// The generic photo-snap tab is retired (SPEC.md §34) — photo/voice are now
// answer modes gated per-question inside Pulse, not a free-floating feature.
const TABS = [
  { key: "home", ...strings.tabs.home, icon: "home" },
  { key: "pulse", ...strings.tabs.pulse, icon: "pulse" },
  { key: "products", ...strings.tabs.products, icon: "storefront" },
  { key: "community", ...strings.tabs.community, icon: "people" },
  { key: "vault", ...strings.tabs.vault, icon: "shield-checkmark" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function MainApp({ session, onLogout }: Props) {
  const [tab, setTab] = useState<TabKey>("home");
  const insets = useSafeAreaInsets();

  // Registered here rather than at login: this runs on every launch, so a
  // member who declined the prompt once gets asked again next time they open
  // the app, and a token FCM rotated while they were away is re-registered
  // without them doing anything. Both calls are silent on failure.
  useEffect(() => {
    registerForPushNotifications(session.token);
    return watchForTokenRefresh(session.token);
  }, [session.token]);

  return (
    <View style={styles.container}>
      {/* Above the tab content, so branding and the member's username are
          present on every screen rather than only on Home. */}
      <AppHeader session={session} topInset={insets.top} />
      <View style={styles.screen}>
        {tab === "home" && <HomeScreen session={session} onNavigate={setTab} />}
        {tab === "pulse" && <PulseScreen session={session} />}
        {tab === "products" && <ProductsScreen session={session} />}
        {tab === "community" && <CommunityScreen session={session} />}
        {tab === "vault" && <VaultScreen session={session} onLogout={onLogout} />}
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
