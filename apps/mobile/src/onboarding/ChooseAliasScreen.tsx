import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { commitAlias, CommitAliasResult, getAliasCandidates } from "../api";
import { colors, radii, spacing, type } from "../theme";
import { ProgressDots } from "./ProgressDots";

interface Props {
  pendingToken: string;
  candidates: string[];
  onChosen: (result: CommitAliasResult) => void;
}

const TOTAL_STEPS = 5;

export function ChooseAliasScreen({ pendingToken, candidates: initial, onChosen }: Props) {
  const [candidates, setCandidates] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function shuffle() {
    setShuffling(true);
    setSelected(null);
    try {
      const { candidates: fresh } = await getAliasCandidates(pendingToken);
      setCandidates(fresh);
    } catch (err) {
      Alert.alert("Couldn't fetch more names", (err as Error).message);
    } finally {
      setShuffling(false);
    }
  }

  async function confirm() {
    if (!selected) return;
    setConfirming(true);
    try {
      const result = await commitAlias(pendingToken, selected);
      onChosen(result);
    } catch (err) {
      Alert.alert("Couldn't save that name", (err as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        <ProgressDots step={3} total={TOTAL_STEPS} />

        <Text style={styles.title}>Pick your public name</Text>
        <Text style={styles.subtitle}>
          This is what everyone else ever sees — never your real name, never your phone number.
          Tap one you like, or shuffle for more.
        </Text>

        <View style={styles.grid}>
          {candidates.map((c) => {
            const on = c === selected;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.card, on && styles.cardOn]}
                onPress={() => setSelected(c)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={on ? "checkmark-circle" : "person-circle-outline"}
                  size={20}
                  color={on ? colors.onDark : colors.teal}
                />
                <Text style={[styles.cardText, on && styles.cardTextOn]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.shuffleBtn} onPress={shuffle} disabled={shuffling} activeOpacity={0.8}>
          {shuffling ? (
            <ActivityIndicator color={colors.teal} size="small" />
          ) : (
            <>
              <Ionicons name="shuffle" size={16} color={colors.teal} />
              <Text style={styles.shuffleText}>Show me more names</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, !selected && styles.buttonDisabled]}
          disabled={!selected || confirming}
          onPress={confirm}
          activeOpacity={0.85}
        >
          {confirming ? (
            <ActivityIndicator color={colors.onDark} />
          ) : (
            <Text style={styles.buttonText}>{selected ? `Continue as ${selected}` : "Pick a name to continue"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, padding: spacing.xl, paddingTop: 64, paddingBottom: spacing.xl },
  title: { ...type.title, textAlign: "center", color: colors.ink, marginTop: spacing.xl },
  subtitle: {
    ...type.body,
    textAlign: "center",
    color: colors.subtle,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    lineHeight: 21,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.base,
  },
  cardOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  cardText: { fontSize: 13.5, fontWeight: "700", color: colors.ink, letterSpacing: 0.2 },
  cardTextOn: { color: colors.onDark },
  shuffleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  shuffleText: { color: colors.teal, fontWeight: "700", fontSize: 14 },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.paper,
  },
  button: {
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: colors.tealSoft },
  buttonText: { color: colors.onDark, fontWeight: "700", fontSize: 15 },
});
