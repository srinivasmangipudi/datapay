// DataPay brand mark + wordmark (apps/assets/DataPayLogo.tsx, copied in as-is —
// see apps/assets/README.md for the full brand system this comes from).
// Inline SVG so it scales crisply with no separate image request.
// <DataPayMark size={40} /> · <DataPayLogo /> · <DataPayLogo dark />
import * as React from "react";

const TOKENS = {
  ink: "#101418",
  porcelain: "#F6F5F1",
  jade: "#0E7A5C",
  jadeBright: "#12946F",
  // Deepened from the brand package's #B98F2F, which sat at 2.9:1 on paper —
  // under the 3:1 floor for a non-text graphic. globals.css made this change
  // for --brass already; the logo kept the old value, so the wordmark's brass
  // visibly differed from every other brass on the same page.
  brass: "#a67c21",
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

/**
 * The wordmark alone — "Data" in ink, "Pay" in brass with the brand's -9° lean.
 *
 * Exists because three navs rendered a plain <span>DataPay</span> instead, so
 * the brand appeared flat and monochrome in the chrome of every page while the
 * hero lockup right below it leaned and used brass. Inherits font-size and
 * colour from its context, so a nav can size it like any other label.
 */
export function DataPayWordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
      <span style={{ color: dark ? TOKENS.porcelain : TOKENS.ink }}>Data</span>
      <span
        style={{
          color: dark ? TOKENS.brassBright : TOKENS.brass,
          display: "inline-block",
          transform: "skewX(-9deg)",
        }}
      >
        Pay
      </span>
    </span>
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
