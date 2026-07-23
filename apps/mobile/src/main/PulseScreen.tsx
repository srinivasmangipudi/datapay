import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPulseToday, PulseQuestion } from "../api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { strings } from "../i18n/strings";
import { enqueueAnswer, flushOutbox } from "../outbox";
import type { Session } from "../session";
import { colors, radii, spacing } from "../theme";

interface Props {
  session: Session;
}

export function PulseScreen({ session }: Props) {
  const [questions, setQuestions] = useState<PulseQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const today = await getPulseToday(session.token);
    setQuestions(today);
    setIndex(0);
    setSelected([]);
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    const question = questions![index];
    enqueueAnswer({
      clientMsgId: Crypto.randomUUID(),
      questionId: question.id,
      optionIds: selected,
      inputMode: "tap",
      language: session.locale ?? "en",
      answeredAt: new Date().toISOString(),
    });
    setSelected([]);
    setIndex((i) => i + 1);
    // Best-effort background sync — the outbox is the source of truth if this fails.
    flushOutbox(session.token).catch(() => {});
  }

  function toggleOption(optionId: number, multi: boolean) {
    setSelected((prev) => {
      if (multi) {
        return prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId];
      }
      return [optionId];
    });
  }

  if (!questions) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  if (index >= questions.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle}>{strings.pulse.allCaughtUp.en}</Text>
        <Text style={styles.doneTitleKn}>{strings.pulse.allCaughtUp.kn}</Text>
        <Text style={styles.doneSubtitle}>{strings.pulse.moreTomorrow.en}</Text>
        <Text style={styles.doneSubtitleKn}>{strings.pulse.moreTomorrow.kn}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshText}>{strings.pulse.checkAgain.en}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const question = questions[index];
  const isMulti = question.type === "multi";

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.progressTrack}>
        {questions.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSegment,
              i < index && styles.progressDone,
              i === index && styles.progressCurrent,
            ]}
          />
        ))}
      </View>
      <Text style={styles.progressLabel}>
        {strings.pulse.questionOf.en} {index + 1} {strings.pulse.of.en} {questions.length}
      </Text>

      <Card style={styles.card}>
        <Text style={styles.question}>{question.textEn}</Text>
        {question.textKn && <Text style={styles.questionKn}>{question.textKn}</Text>}

        <View style={styles.chips}>
          {question.options.map((opt) => {
            const on = selected.includes(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => toggleOption(opt.id, isMulti)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.labelEn}</Text>
                {opt.labelKn && (
                  <Text style={[styles.chipTextKn, on && styles.chipTextOn]}>{opt.labelKn}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.reward}>+{question.rewardTokens} ◈</Text>
      </Card>

      <Button
        label={strings.pulse.confirm.en}
        labelKn={strings.pulse.confirm.kn}
        onPress={submit}
        disabled={selected.length === 0}
        style={styles.submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: spacing.lg },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
  },
  progressTrack: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressDone: { backgroundColor: colors.teal },
  progressCurrent: { backgroundColor: colors.brass },
  progressLabel: { fontSize: 12, color: colors.faint, marginBottom: spacing.lg, fontWeight: "600" },
  card: { flex: 0 },
  question: { fontSize: 19, fontWeight: "700", marginBottom: spacing.sm, color: colors.ink },
  questionKn: { fontSize: 15, color: colors.subtle, marginBottom: spacing.base, fontWeight: "500" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  chipOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  chipTextKn: { fontSize: 12, fontWeight: "500", color: colors.subtle, marginTop: 1 },
  chipTextOn: { color: colors.onDark },
  reward: { marginTop: spacing.lg, fontSize: 13, color: colors.brass, fontWeight: "700" },
  submit: { marginTop: spacing.xl },
  doneTitle: { fontSize: 21, fontWeight: "700", color: colors.ink },
  doneTitleKn: { fontSize: 17, fontWeight: "600", color: colors.subtle, marginTop: 4 },
  doneSubtitle: { fontSize: 14, color: colors.subtle, marginTop: spacing.base },
  doneSubtitleKn: { fontSize: 13, color: colors.faint, marginTop: 2 },
  refreshBtn: { marginTop: spacing.xl },
  refreshText: { color: colors.teal, fontWeight: "700", fontSize: 15 },
});
