import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { completeOnboarding, ConsentCategory, getConsents, getMe, getZones, MemberProfile, setConsent, Zone } from "../api";
import { ZonePickerScreen } from "../onboarding/ZonePickerScreen";
import { saveSession } from "../session";
import type { Session } from "../session";

interface Props {
  session: Session;
  onLogout: () => void;
}

// Walks the zone tree from a leaf up to the root, root-first, for a
// "Village, Region" style breadcrumb — same parent-chain logic as
// ZonePickerScreen's drill-down, just read bottom-up instead of top-down.
function zoneBreadcrumb(zoneId: string, zones: Zone[]): string {
  const byId = new Map(zones.map((z) => [z.id, z]));
  const chain: Zone[] = [];
  let current = byId.get(zoneId);
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain.map((z) => z.name).join(", ");
}

export function VaultScreen({ session, onLogout }: Props) {
  const [categories, setCategories] = useState<ConsentCategory[] | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [changingArea, setChangingArea] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const [consentList, memberProfile, zoneList] = await Promise.all([
      getConsents(session.token),
      getMe(session.token),
      getZones(),
    ]);
    setCategories(consentList);
    setProfile(memberProfile);
    setZones(zoneList);
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  // Same completeOnboarding() endpoint onboarding itself uses — it's already
  // an upsert (SPEC.md §38's zoneConfirmed/requestedAreaNote persist here
  // too), so changing area later is the exact same call, not a new one.
  async function changeArea(zone: Zone, meta?: { zoneConfirmed: boolean; requestedAreaNote?: string }) {
    try {
      await completeOnboarding(session.token, zone.id, session.locale, meta);
      await saveSession({ ...session, zoneId: zone.id });
      setChangingArea(false);
      await load();
    } catch (err) {
      Alert.alert("Couldn't update your area", (err as Error).message);
    }
  }

  async function toggle(categoryId: number, granted: boolean) {
    setCategories((prev) =>
      prev ? prev.map((c) => (c.categoryId === categoryId ? { ...c, granted } : c)) : prev
    );
    await setConsent(session.token, categoryId, granted);
  }

  function confirmLogout() {
    Alert.alert(
      "Log out?",
      "You'll need your phone number and a new OTP to sign back in — as this alias, or a different account.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log out", style: "destructive", onPress: onLogout },
      ]
    );
  }

  if (!categories || !profile || !zones) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      <Text style={styles.alias}>{session.displayAlias}</Text>
      <Text style={styles.sealNote}>
        Brands only ever see this alias. Identity never shared — every toggle below is instant and
        logged in your audit trail.
      </Text>

      <View style={styles.areaCard}>
        <Text style={styles.areaLabel}>YOUR AREA</Text>
        <Text style={styles.areaValue}>{zoneBreadcrumb(profile.zoneId, zones)}</Text>
        {!profile.zoneConfirmed && (
          <Text style={styles.areaNote}>
            Closest match for now — we'll refine this as we add your exact area.
          </Text>
        )}
        <TouchableOpacity onPress={() => setChangingArea(true)}>
          <Text style={styles.changeAreaText}>Change area →</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={changingArea} animationType="slide" onRequestClose={() => setChangingArea(false)}>
        <ZonePickerScreen token={session.token} onSelected={changeArea} onCancel={() => setChangingArea(false)} />
      </Modal>

      {categories.map((c) => (
        <View key={c.categoryId} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowName}>{c.name}</Text>
            {c.nameKn && <Text style={styles.rowNameKn}>{c.nameKn}</Text>}
          </View>
          <Switch value={c.granted} onValueChange={(v) => toggle(c.categoryId, v)} />
        </View>
      ))}

      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20, paddingTop: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  alias: { fontSize: 20, fontWeight: "700" },
  sealNote: { fontSize: 13, color: "#666", marginTop: 8, marginBottom: 24, lineHeight: 19 },
  areaCard: {
    backgroundColor: "#F6F5F1",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  areaLabel: { fontSize: 11, color: "#8A939B", letterSpacing: 1.2, fontWeight: "700" },
  areaValue: { fontSize: 16, fontWeight: "700", color: "#101418", marginTop: 6 },
  areaNote: { fontSize: 12, color: "#B98F2F", marginTop: 6, lineHeight: 16 },
  changeAreaText: { fontSize: 13, color: "#0E7A5C", fontWeight: "700", marginTop: 12 },
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
  logoutBtn: {
    marginTop: 32,
    marginBottom: 24,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#8c3a34",
    alignItems: "center",
  },
  logoutText: { color: "#8c3a34", fontWeight: "700", fontSize: 15 },
});
