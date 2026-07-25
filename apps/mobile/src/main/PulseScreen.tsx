import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPulseToday, PulseQuestion, transcribeVoice } from "../api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { hasFace } from "../faceDetector";
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
  const [numericInput, setNumericInput] = useState("");
  const [note, setNote] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [usedVoice, setUsedVoice] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const insets = useSafeAreaInsets();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const load = useCallback(async () => {
    const today = await getPulseToday(session.token);
    setQuestions(today);
    setIndex(0);
    resetSupplements();
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  function resetSupplements() {
    setSelected([]);
    setNumericInput("");
    setNote("");
    setPhotoBase64(null);
    setUsedVoice(false);
  }

  async function submit() {
    const question = questions![index];
    const isNumeric = question.type === "numeric";
    const isFreeText = question.type === "free_text";
    // A single categorical inputMode, so precedence matters when more than
    // one supplement is present: a photo is the richest evidence, then a
    // voice-sourced note, then whatever the question type itself implies.
    const inputMode = photoBase64 ? "snap" : usedVoice ? "voice" : isFreeText ? "text" : "tap";
    const coords = await getBestEffortLocation();
    enqueueAnswer({
      clientMsgId: Crypto.randomUUID(),
      questionId: question.id,
      optionIds: isNumeric || isFreeText ? undefined : selected,
      numericValue: isNumeric ? Number(numericInput) : undefined,
      textValue: note.trim() || undefined,
      photoBase64: photoBase64 || undefined,
      inputMode,
      language: session.locale ?? "en",
      answeredAt: new Date().toISOString(),
      lat: coords?.lat,
      lng: coords?.lng,
    });
    resetSupplements();
    setIndex((i) => i + 1);
    // Best-effort background sync — the outbox is the source of truth if this fails.
    flushOutbox(session.token).catch(() => {});
  }

  /**
   * SPEC.md §35 — a cached ("last known") reading, not a fresh GPS fix: this
   * app is offline-first-by-design (answers enqueue locally the instant
   * they're given), and requesting a live fix can take seconds on a cold
   * GPS — that would visibly stall every single answer. A missing/denied
   * reading is a normal outcome, not an error; the question still submits.
   */
  async function getBestEffortLocation(): Promise<{ lat: number; lng: number } | null> {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let granted = current.status === "granted";
      if (!granted && current.canAskAgain) {
        granted = (await Location.requestForegroundPermissionsAsync()).status === "granted";
      }
      if (!granted) return null;

      const position = await Location.getLastKnownPositionAsync();
      if (!position) return null;
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch {
      return null;
    }
  }

  function toggleOption(optionId: number, multi: boolean) {
    setSelected((prev) => {
      if (multi) {
        return prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId];
      }
      return [optionId];
    });
  }

  async function toggleRecording() {
    if (recorderState.isRecording) {
      await recorder.stop();
      if (!recorder.uri) return;
      setTranscribing(true);
      try {
        const audioBase64 = await new File(recorder.uri).base64();
        const result = await transcribeVoice(session.token, audioBase64, session.locale ?? "en");
        const heard = result.translatedText ?? result.transcript;
        if (heard) {
          setNote((prev) => (prev ? `${prev}\n${heard}` : heard));
          setUsedVoice(true);
        }
      } catch (err) {
        Alert.alert(strings.pulse.transcribeFailedTitle.en, (err as Error).message);
      } finally {
        setTranscribing(false);
      }
      return;
    }

    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) return;
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function attachPhoto() {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return;
    // launchCameraAsync's native camera UI already shows a freeze-frame +
    // "use photo / retake" confirmation before returning — no separate
    // preview step needed here, unlike the old raw-CameraView Snap screen.
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
    if (result.canceled || !result.assets[0]?.base64) return;

    if (await hasFace(result.assets[0].base64)) {
      Alert.alert(strings.pulse.photoRejectedTitle.en, strings.pulse.photoRejectedBody.en);
      return;
    }
    setPhotoBase64(result.assets[0].base64);
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
  const isNumeric = question.type === "numeric";
  const isFreeText = question.type === "free_text";
  const canSubmit = isNumeric
    ? numericInput.trim() !== "" && !isNaN(Number(numericInput))
    : isFreeText
      ? note.trim().length > 0
      : selected.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
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
        {question.textHi && <Text style={styles.questionKn}>{question.textHi}</Text>}
        {question.textLocal && <Text style={styles.questionKn}>{question.textLocal}</Text>}

        {isNumeric ? (
          <TextInput
            style={styles.numericInput}
            value={numericInput}
            onChangeText={setNumericInput}
            placeholder={strings.pulse.numericPlaceholder.en}
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
          />
        ) : isFreeText ? null : (
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
        )}

        <Text style={styles.reward}>+{question.rewardTokens} ◈</Text>

        <View style={isFreeText ? undefined : styles.supplements}>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder={isFreeText ? strings.pulse.freeTextPlaceholder.en : strings.pulse.addNote.en}
            placeholderTextColor={colors.faint}
            multiline
          />

          <View style={styles.supplementRow}>
            {question.allowVoice && (
              <TouchableOpacity
                style={[styles.supplementBtn, recorderState.isRecording && styles.supplementBtnActive]}
                onPress={toggleRecording}
                disabled={transcribing}
                activeOpacity={0.8}
              >
                {transcribing ? (
                  <ActivityIndicator color={colors.teal} size="small" />
                ) : (
                  <Ionicons
                    name={recorderState.isRecording ? "stop-circle" : "mic-outline"}
                    size={18}
                    color={recorderState.isRecording ? colors.danger : colors.teal}
                  />
                )}
                <Text style={styles.supplementText}>
                  {transcribing
                    ? strings.pulse.transcribing.en
                    : recorderState.isRecording
                      ? strings.pulse.recording.en
                      : strings.pulse.recordVoiceNote.en}
                </Text>
              </TouchableOpacity>
            )}

            {question.allowPhoto &&
              (photoBase64 ? (
                <View style={styles.photoPreviewWrap}>
                  <Image source={{ uri: `data:image/jpeg;base64,${photoBase64}` }} style={styles.photoPreview} />
                  <TouchableOpacity onPress={() => setPhotoBase64(null)}>
                    <Text style={styles.removePhoto}>{strings.pulse.removePhoto.en}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.supplementBtn} onPress={attachPhoto} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={18} color={colors.teal} />
                  <Text style={styles.supplementText}>{strings.pulse.attachPhoto.en}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      </Card>

      <Button
        label={strings.pulse.confirm.en}
        labelKn={strings.pulse.confirm.kn}
        onPress={submit}
        disabled={!canSubmit}
        style={styles.submit}
      />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, backgroundColor: colors.paper, paddingHorizontal: spacing.lg },
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
  numericInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: 18,
    color: colors.ink,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
  },
  supplements: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
    minHeight: 44,
    textAlignVertical: "top",
  },
  supplementRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  supplementBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.surface,
  },
  supplementBtnActive: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  supplementText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  photoPreviewWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  photoPreview: { width: 36, height: 36, borderRadius: radii.sm },
  removePhoto: { fontSize: 12, fontWeight: "700", color: colors.danger },
  submit: { marginTop: spacing.xl },
  doneTitle: { fontSize: 21, fontWeight: "700", color: colors.ink },
  doneTitleKn: { fontSize: 17, fontWeight: "600", color: colors.subtle, marginTop: 4 },
  doneSubtitle: { fontSize: 14, color: colors.subtle, marginTop: spacing.base },
  doneSubtitleKn: { fontSize: 13, color: colors.faint, marginTop: 2 },
  refreshBtn: { marginTop: spacing.xl },
  refreshText: { color: colors.teal, fontWeight: "700", fontSize: 15 },
});
