// DataPay brand mark + wordmark (apps/assets/DataPayLogo.native.tsx, copied
// in as-is — see apps/assets/README.md for the full brand system this comes
// from). The wordmark falls back to the system font: Cabinet Grotesk /
// Spline Sans Mono aren't bundled in this app yet (no font files were part
// of the brand package drop), so "Pay"'s -9° lean and brass color still
// render, just not in the custom display face until those fonts are added.
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
  // Falls back to the system font until CabinetGrotesk-Extrabold is loaded via expo-font.
  wm: { fontFamily: "CabinetGrotesk-Extrabold", fontWeight: "800", letterSpacing: -1.4 },
  // RN can't skew a Text run inline; the -9° lean is applied as a transform.
  pay: { transform: [{ skewX: "-9deg" }] as any },
  tag: { fontFamily: "SplineSansMono", fontSize: 11, letterSpacing: 1.6, color: dataPayTokens.mist },
});
