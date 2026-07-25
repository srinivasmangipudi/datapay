import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { resolveLocation, getZones, type ResolveLocationResult, type Zone } from "../api";
import { colors, radii, spacing, type } from "../theme";
import { ProgressDots } from "./ProgressDots";

interface SelectionMeta {
  zoneConfirmed: boolean;
  requestedAreaNote?: string;
}

interface Props {
  token: string;
  onSelected: (zone: Zone, meta?: SelectionMeta) => void;
  // Present when reused post-onboarding (VaultScreen's "Change area") —
  // swaps the step-progress framing for a plain close button, since "step 4
  // of 5" makes no sense outside the signup flow.
  onCancel?: () => void;
}

const LEVEL_ORDER: Zone["level"][] = ["constituency", "hobli", "panchayat", "village"];
const LEVEL_LABEL: Record<Zone["level"], string> = {
  constituency: "Pick your constituency",
  hobli: "Pick your hobli",
  panchayat: "Pick your panchayat",
  village: "Pick your village",
};
const TOTAL_STEPS = 5;

export function ZonePickerScreen({ token, onSelected, onCancel }: Props) {
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [path, setPath] = useState<Zone[]>([]); // breadcrumb of selections, root to leaf
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    getZones()
      .then(setZones)
      .catch((err) => Alert.alert("Couldn't load zones", (err as Error).message));
  }, []);

  if (!zones) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  if (showFallback) {
    return <AreaNotListedFlow token={token} onBack={() => setShowFallback(false)} onSelected={onSelected} />;
  }

  const currentParentId = path.length > 0 ? path[path.length - 1].id : null;
  const currentLevel = LEVEL_ORDER[path.length];
  const options = zones.filter((z) => z.parentId === currentParentId && z.level === currentLevel);

  function selectZone(zone: Zone) {
    if (zone.level === "village") {
      onSelected(zone);
      return;
    }
    setPath([...path, zone]);
  }

  return (
    <View style={styles.container}>
      {onCancel ? (
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <Ionicons name="close" size={22} color={colors.faint} />
        </TouchableOpacity>
      ) : (
        <ProgressDots step={4} total={TOTAL_STEPS} />
      )}

      <Text style={styles.title}>{onCancel ? "Change your area" : "Where are you from?"}</Text>
      <Text style={styles.subtitle}>
        This tells us which local prices and questions matter to your household.
      </Text>

      {path.length > 0 && (
        <View style={styles.breadcrumb}>
          {path.map((z, i) => (
            <View key={z.id} style={styles.crumbRow}>
              <Text style={styles.crumbText}>{z.name}</Text>
              {i < path.length - 1 && <Ionicons name="chevron-forward" size={14} color={colors.faint} />}
            </View>
          ))}
        </View>
      )}
      <Text style={styles.levelLabel}>{LEVEL_LABEL[currentLevel]}</Text>

      <FlatList
        data={options}
        keyExtractor={(z) => z.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => selectZone(item)} activeOpacity={0.8}>
            <View style={styles.rowIcon}>
              <Ionicons
                name={item.level === "village" ? "home-outline" : "location-outline"}
                size={18}
                color={colors.teal}
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowText}>{item.name}</Text>
              {item.nameKn && <Text style={styles.rowSub}>{item.nameKn}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.subtitle}>No zones at this level yet.</Text>}
      />

      <View style={styles.footerRow}>
        {path.length > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={() => setPath(path.slice(0, -1))}>
            <Ionicons name="arrow-back" size={16} color={colors.teal} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.notListedButton} onPress={() => setShowFallback(true)}>
          <Text style={styles.notListedText}>My area isn't listed →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

type FallbackMode = "choose" | "loading" | "result" | "error";

// SPEC.md §38 — a member whose real village isn't in the zones tree yet
// still needs to finish onboarding. "Detect my location" or "enter my
// address," either way geocoded to a real place — matched to an existing
// zone by name, or created on the spot — with a confirmation step before
// it's actually used, since a geocoded guess (especially from typed text)
// can be wrong.
function AreaNotListedFlow({
  token,
  onBack,
  onSelected,
}: {
  token: string;
  onBack: () => void;
  onSelected: (zone: Zone, meta?: SelectionMeta) => void;
}) {
  const [mode, setMode] = useState<FallbackMode>("choose");
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<ResolveLocationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function detectLocation() {
    setMode("loading");
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let granted = current.status === "granted";
      if (!granted) {
        granted = (await Location.requestForegroundPermissionsAsync()).status === "granted";
      }
      if (!granted) {
        setErrorMsg("Location access was declined — you can type your address below instead.");
        setMode("error");
        return;
      }
      // A real, fresh fix — this is a one-time onboarding moment, worth the
      // few seconds it can take (unlike per-answer capture, which
      // deliberately uses only a cached reading, SPEC.md §35).
      const position = await Location.getCurrentPositionAsync({});
      const resolved = await resolveLocation(token, {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setResult(resolved);
      setMode("result");
    } catch (err) {
      setErrorMsg((err as Error).message);
      setMode("error");
    }
  }

  async function lookUpAddress() {
    if (!address.trim()) return;
    setMode("loading");
    try {
      const resolved = await resolveLocation(token, { address: address.trim() });
      setResult(resolved);
      setMode("result");
    } catch (err) {
      setErrorMsg((err as Error).message);
      setMode("error");
    }
  }

  function confirm() {
    if (!result) return;
    onSelected(
      {
        id: result.zone.id,
        parentId: result.zone.parentId,
        level: result.zone.level as Zone["level"],
        name: result.zone.name,
        nameKn: result.zone.nameKn,
      },
      { zoneConfirmed: true }
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={16} color={colors.teal} />
          <Text style={styles.backText}>Back to the list</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Not seeing your area?</Text>
        <Text style={styles.subtitle}>
          Detect your location, or type your address — either way we'll find (or add) the right
          village for you.
        </Text>

        {mode === "loading" && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.teal} />
          </View>
        )}

        {(mode === "choose" || mode === "error") && (
          <>
            <TouchableOpacity style={styles.button} onPress={detectLocation} activeOpacity={0.85}>
              <Ionicons name="locate" size={18} color={colors.onDark} />
              <Text style={styles.buttonText}>Detect my location</Text>
            </TouchableOpacity>

            {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

            <Text style={[styles.label, { marginTop: spacing.xl }]}>Or type your address</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. Near the bus stand, Hosahalli"
              placeholderTextColor={colors.faint}
            />
            <TouchableOpacity
              style={[styles.secondaryButton, !address.trim() && styles.buttonDisabled]}
              onPress={lookUpAddress}
              disabled={!address.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonText}>Look it up</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === "result" && result && (
          <>
            <View style={styles.matchCard}>
              {result.matchType === "created" && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEWLY ADDED</Text>
                </View>
              )}
              <Text style={styles.matchLabel}>We found</Text>
              <Text style={styles.matchName}>{result.zone.name}</Text>
              <Text style={styles.matchDistance}>{result.geocodedLabel}</Text>
            </View>

            <Text style={styles.hint}>Is this right?</Text>

            <TouchableOpacity style={styles.button} onPress={confirm} activeOpacity={0.85}>
              <Text style={styles.buttonText}>Yes, that's my area</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setResult(null);
                setMode("choose");
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, padding: spacing.xl, paddingTop: 64, backgroundColor: colors.paper },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.paper, paddingVertical: spacing.xxl },
  title: { ...type.title, color: colors.ink, marginTop: spacing.xl },
  subtitle: { ...type.body, color: colors.subtle, marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 20 },
  breadcrumb: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: spacing.sm },
  crumbRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  crumbText: { ...type.small, color: colors.teal, fontWeight: "700" },
  levelLabel: { ...type.label, color: colors.faint, marginBottom: spacing.sm },
  list: { gap: spacing.sm, paddingBottom: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.tealTint,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  rowSub: { fontSize: 12.5, color: colors.subtle, marginTop: 1 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.base },
  backText: { color: colors.teal, fontWeight: "700", fontSize: 14 },
  notListedButton: { paddingVertical: spacing.base },
  notListedText: { color: colors.subtle, fontWeight: "600", fontSize: 13 },
  closeButton: { alignSelf: "flex-end", padding: spacing.xs },
  matchCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  matchLabel: { ...type.label, color: colors.faint },
  matchName: { fontSize: 20, fontWeight: "700", color: colors.ink, marginTop: spacing.xs },
  matchDistance: { ...type.small, color: colors.subtle, marginTop: 4 },
  errorText: { ...type.small, color: colors.danger, marginTop: spacing.lg, lineHeight: 19 },
  label: { ...type.small, color: colors.subtle, fontWeight: "600", marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  hint: { ...type.caption, color: colors.faint, marginTop: spacing.sm, marginBottom: spacing.sm },
  button: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xl,
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
    paddingVertical: 16,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.onDark, fontWeight: "700", fontSize: 16 },
  secondaryButton: {
    marginTop: spacing.md,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.ink, fontWeight: "700", fontSize: 15 },
  newBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.brass,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  newBadgeText: { color: colors.onDark, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
});
