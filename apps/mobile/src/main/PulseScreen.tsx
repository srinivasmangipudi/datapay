import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getPulseToday, PulseQuestion } from "../api";
import { enqueueAnswer, flushOutbox } from "../outbox";
import type { Session } from "../session";

interface Props {
  session: Session;
}

export function PulseScreen({ session }: Props) {
  const [questions, setQuestions] = useState<PulseQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);

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
        <ActivityIndicator />
      </View>
    );
  }

  if (index >= questions.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle}>All caught up</Text>
        <Text style={styles.doneSubtitle}>More questions tomorrow.</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshText}>Check again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const question = questions[index];
  const isMulti = question.type === "multi";

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        Question {index + 1} of {questions.length}
      </Text>
      <View style={styles.card}>
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
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.labelEn}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.reward}>+{question.rewardTokens} ◈</Text>
      </View>

      <TouchableOpacity
        style={[styles.submit, selected.length === 0 && styles.submitDisabled]}
        disabled={selected.length === 0}
        onPress={submit}
      >
        <Text style={styles.submitText}>Confirm</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20, paddingTop: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  progress: { fontSize: 12, color: "#8A939B", marginBottom: 14 },
  card: { backgroundColor: "#FBFAF7", borderRadius: 18, padding: 22, borderWidth: 1, borderColor: "#E7E4DC" },
  question: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  questionKn: { fontSize: 14, color: "#666", marginBottom: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    borderWidth: 1,
    borderColor: "#DDD9CF",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  chipOn: { backgroundColor: "#0E7A5C", borderColor: "#0E7A5C" },
  chipText: { fontSize: 13, fontWeight: "500", color: "#333" },
  chipTextOn: { color: "#fff" },
  reward: { marginTop: 18, fontSize: 12, color: "#B98F2F", fontWeight: "600" },
  submit: {
    marginTop: 24,
    backgroundColor: "#0E7A5C",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitDisabled: { backgroundColor: "#B7D9CD" },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  doneTitle: { fontSize: 20, fontWeight: "700" },
  doneSubtitle: { fontSize: 14, color: "#666", marginTop: 6 },
  refreshBtn: { marginTop: 20 },
  refreshText: { color: "#0E7A5C", fontWeight: "600" },
});
