// ─────────────────────────────────────────────────────────────
// DataPay · React logo component (Next.js / any React web app)
// Inline SVG so it inherits currentColor-free brand tokens and scales crisply.
// <DataPayMark size={40} /> · <DataPayLogo /> · <DataPayLogo dark />
// ─────────────────────────────────────────────────────────────
import * as React from "react";

const TOKENS = {
  ink: "#101418",
  porcelain: "#F6F5F1",
  jade: "#0E7A5C",
  jadeBright: "#12946F",
  brass: "#B98F2F",
  brassBright: "#D4AA45",
  mist: "#8A939B",
} as const;

type MarkProps = { size?: number; dark?: boolean; title?: string };

export function DataPayMark({ size = 40, dark = false, title = "DataPay" }: MarkProps) {
  const ring = dark ? TOKENS.porcelain : TOKENS.ink;
  const brass = dark ? TOKENS.brassBright : TOKENS.brass;
  const square = dark ? TOKENS.jadeBright : TOKENS.jade;
  const dot = dark ? TOKENS.ink : TOKENS.porcelain;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title}>
      <path d="M50 10 A40 40 0 0 0 50 90" fill="none" stroke={ring} strokeWidth="8.5" strokeLinecap="round" />
      <path d="M50 10 A40 40 0 0 1 50 90" fill="none" stroke={brass} strokeWidth="8.5" strokeLinecap="round" />
      <rect x="35" y="35" width="30" height="30" rx="7" fill={square} />
      <circle cx="50" cy="50" r="5.5" fill={dot} />
    </svg>
  );
}

type LogoProps = MarkProps & { tagline?: string };

export function DataPayLogo({ size = 44, dark = false, tagline }: LogoProps) {
  const ink = dark ? TOKENS.porcelain : TOKENS.ink;
  const brass = dark ? TOKENS.brassBright : TOKENS.brass;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
      <DataPayMark size={size} dark={dark} />
      <span style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
        <span
          style={{
            fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: size * 0.62,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: ink,
          }}
        >
          Data
          <span style={{ color: brass, display: "inline-block", transform: "skewX(-9deg)" }}>Pay</span>
        </span>
        {tagline && (
          <span
            style={{
              fontFamily: "'Spline Sans Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: TOKENS.mist,
            }}
          >
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}

export const dataPayTokens = TOKENS;
