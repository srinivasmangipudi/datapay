import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { submitSnap } from "../api";
import { Button } from "../components/Button";
import { hasFace } from "../faceDetector";
import { strings } from "../i18n/strings";
import type { Session } from "../session";
import { colors, spacing } from "../theme";

interface Props {
  session: Session;
}

export function SnapScreen({ session }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<{ en: string; kn: string } | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

  async function capture() {
    if (!cameraRef.current) return;
    setUploading(true);
    try {
      // exif: false strips location/device metadata at capture time — no
      // separate EXIF-stripping pass needed (SPEC.md §8.4).
      const photo = await cameraRef.current.takePictureAsync({ base64: true, exif: false });
      if (!photo?.base64) throw new Error("Capture failed");

      if (await hasFace(photo.base64)) {
        Alert.alert(strings.snap.rejectedTitle.en, strings.snap.rejectedBody.en);
        return;
      }

      const result = await submitSnap(session.token, {
        clientMsgId: Crypto.randomUUID(),
        imageBase64: photo.base64,
        capturedAt: new Date().toISOString(),
      });
      setLastResult(result.status === "credited" ? strings.snap.savedCredited : strings.snap.savedDuplicate);
    } catch (err) {
      Alert.alert(strings.snap.uploadFailedTitle.en, (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={40} color={colors.faint} style={{ marginBottom: spacing.base }} />
        <Text style={styles.permText}>{strings.snap.permissionNeeded.en}</Text>
        <Text style={styles.permTextKn}>{strings.snap.permissionNeeded.kn}</Text>
        <Button
          label={strings.snap.allowCamera.en}
          labelKn={strings.snap.allowCamera.kn}
          onPress={requestPermission}
          style={styles.permBtn}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {lastResult && (
          <View style={styles.resultPill}>
            <Text style={styles.result}>{lastResult.en}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.shutter} disabled={uploading} onPress={capture} activeOpacity={0.85}>
          {uploading ? <ActivityIndicator color={colors.onDark} /> : <View style={styles.shutterInner} />}
        </TouchableOpacity>
        <Text style={styles.hint}>{strings.snap.hint.en}</Text>
        <Text style={styles.hintKn}>{strings.snap.hint.kn}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.paper,
    padding: spacing.xl,
  },
  camera: { flex: 1 },
  controls: { padding: spacing.xl, alignItems: "center", backgroundColor: colors.ink },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.teal,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: colors.onDark,
  },
  shutterInner: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.onDark },
  hint: { color: colors.onDarkSubtle, fontSize: 13, marginTop: spacing.md, textAlign: "center", fontWeight: "500" },
  hintKn: { color: colors.onDarkFaint, fontSize: 12, marginTop: 3, textAlign: "center", fontWeight: "500" },
  resultPill: {
    backgroundColor: "rgba(212,170,69,0.16)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
  },
  result: { color: colors.brassOnDark, fontSize: 13, fontWeight: "700" },
  permText: { fontSize: 15, color: colors.ink, textAlign: "center", fontWeight: "600" },
  permTextKn: { fontSize: 13, color: colors.subtle, textAlign: "center", marginTop: 4, marginBottom: spacing.lg },
  permBtn: { paddingHorizontal: spacing.xl, alignSelf: "stretch" },
});
