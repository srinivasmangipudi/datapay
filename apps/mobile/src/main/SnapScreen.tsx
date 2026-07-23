import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { submitSnap } from "../api";
import { hasFace } from "../faceDetector";
import type { Session } from "../session";

interface Props {
  session: Session;
}

export function SnapScreen({ session }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  async function capture() {
    if (!cameraRef.current) return;
    setUploading(true);
    try {
      // exif: false strips location/device metadata at capture time — no
      // separate EXIF-stripping pass needed (SPEC.md §8.4).
      const photo = await cameraRef.current.takePictureAsync({ base64: true, exif: false });
      if (!photo?.base64) throw new Error("Capture failed");

      if (await hasFace(photo.base64)) {
        Alert.alert("Photo rejected", "This looks like it contains a person. Try again without one.");
        return;
      }

      const result = await submitSnap(session.token, {
        clientMsgId: Crypto.randomUUID(),
        imageBase64: photo.base64,
        capturedAt: new Date().toISOString(),
      });
      setLastResult(result.status === "credited" ? "Snap saved — tokens on the way." : "Already saved.");
    } catch (err) {
      Alert.alert("Couldn't upload snap", (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera access is needed to snap what you use.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={styles.controls}>
        {lastResult && <Text style={styles.result}>{lastResult}</Text>}
        <TouchableOpacity style={styles.shutter} disabled={uploading} onPress={capture}>
          {uploading ? <ActivityIndicator color="#fff" /> : <View style={styles.shutterInner} />}
        </TouchableOpacity>
        <Text style={styles.hint}>Point at what you use — toothpaste, rice bag, soap.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", padding: 24 },
  camera: { flex: 1 },
  controls: { padding: 24, alignItems: "center", backgroundColor: "#101418" },
  shutter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0E7A5C",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  shutterInner: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" },
  hint: { color: "#8A939B", fontSize: 12, marginTop: 12, textAlign: "center" },
  result: { color: "#D4AA45", fontSize: 13, marginBottom: 10 },
  permText: { fontSize: 14, color: "#444", textAlign: "center", marginBottom: 16 },
  permBtn: { backgroundColor: "#0E7A5C", borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24 },
  permBtnText: { color: "#fff", fontWeight: "600" },
});
