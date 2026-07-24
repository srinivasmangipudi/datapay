// ─────────────────────────────────────────────────────────────
// DataPay · React Native / Expo logo component
// Requires: npx expo install react-native-svg
// <DataPayMark size={40} /> · <DataPayMark size={40} dark />
// The wordmark uses <Text> so load Cabinet Grotesk + Spline Sans Mono
// via expo-font (see fonts note at bottom).
// ─────────────────────────────────────────────────────────────
import * as React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";

export const dataPayTokens = {
  ink: "#101418",
  porcelain: "#F6F5F1",
  jade: "#0E7A5C",
  jadeBright: "#12946F",
  brass: "#B98F2F",
  brassBright: "#D4AA45",
  mist: "#8A939B",
};

type MarkProps = { size?: number; dark?: boolean };

export function DataPayMark({ size = 40, dark = false }: MarkProps) {
  const ring = dark ? dataPayTokens.porcelain : dataPayTokens.ink;
  const brass = dark ? dataPayTokens.brassBright : dataPayTokens.brass;
  const square = dark ? dataPayTokens.jadeBright : dataPayTokens.jade;
  const dot = dark ? dataPayTokens.ink : dataPayTokens.porcelain;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M50 10 A40 40 0 0 0 50 90" fill="none" stroke={ring} strokeWidth={8.5} strokeLinecap="round" />
      <Path d="M50 10 A40 40 0 0 1 50 90" fill="none" stroke={brass} strokeWidth={8.5} strokeLinecap="round" />
      <Rect x={35} y={35} width={30} height={30} rx={7} fill={square} />
      <Circle cx={50} cy={50} r={5.5} fill={dot} />
    </Svg>
  );
}

type LogoProps = MarkProps & { tagline?: string };

export function DataPayLogo({ size = 44, dark = false, tagline }: LogoProps) {
  const ink = dark ? dataPayTokens.porcelain : dataPayTokens.ink;
  const brass = dark ? dataPayTokens.brassBright : dataPayTokens.brass;
  return (
    <View style={styles.row}>
      <DataPayMark size={size} dark={dark} />
      <View style={styles.col}>
        <Text style={[styles.wm, { fontSize: size * 0.6, color: ink }]}>
          Data<Text style={[styles.pay, { color: brass }]}>Pay</Text>
        </Text>
        {tagline ? <Text style={styles.tag}>{tagline.toUpperCase()}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  col: { flexDirection: "column", gap: 2 },
  // If Cabinet Grotesk isn't loaded yet these fall back to the system font.
  wm: { fontFamily: "CabinetGrotesk-Extrabold", fontWeight: "800", letterSpacing: -1.4 },
  // RN can't skew a Text run inline; the -9° lean is applied as a transform.
  pay: { transform: [{ skewX: "-9deg" }] as any },
  tag: { fontFamily: "SplineSansMono", fontSize: 11, letterSpacing: 1.6, color: dataPayTokens.mist },
});

/*
FONTS (expo-font):
  npx expo install expo-font
  import { useFonts } from "expo-font";
  const [loaded] = useFonts({
    "CabinetGrotesk-Extrabold": require("./assets/fonts/CabinetGrotesk-Extrabold.otf"),
    "SplineSansMono": require("./assets/fonts/SplineSansMono-Regular.ttf"),
  });
  Download Cabinet Grotesk + Switzer from fontshare.com, Spline Sans Mono from Google Fonts.
Note: React Native's skewX on a Text run can vary by platform; if the lean looks off on
Android, wrap "Pay" in its own <View> with the transform instead of styling the Text.
*/
