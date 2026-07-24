// ─────────────────────────────────────────────────────────────
// DataPay · Design tokens (single source of truth for web + native)
// Import wherever you need brand values. Keep this file identical
// across the Next.js app and the Expo app.
// ─────────────────────────────────────────────────────────────

export const color = {
  ink: "#101418",        // primary text, dark surfaces — "custody"
  ink2: "#1A2027",       // raised dark surface
  porcelain: "#F6F5F1",  // light surface
  porcelain2: "#EFEDE6", // sunken light surface
  jade: "#0E7A5C",       // trust, growth, the data record (primary accent)
  jadeBright: "#12946F", // jade on dark
  jadeSoft: "#E3EFEA",   // jade tint (badges, fills)
  brass: "#B98F2F",      // VALUE & MONEY ONLY + the "Pay" wordmark
  brassBright: "#D4AA45",// brass on dark
  mist: "#8A939B",       // secondary text
} as const;

export const font = {
  display: "'Cabinet Grotesk', system-ui, sans-serif", // weight 800, used sparingly, large
  body: "'Switzer', system-ui, sans-serif",            // 400 / 500
  mono: "'Spline Sans Mono', monospace",               // all figures, tokens, aliases (tabular)
} as const;

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } as const;

// The token currency glyph. Use in mono runs: `${TOKEN} 482`
export const TOKEN = "\u25C8"; // ◈

// Usage guardrails (enforced by convention, not code):
// • brass is reserved for money/value and the "Pay" wordmark — never body text.
// • the "Pay" wordmark leans -9°; "Data" stays upright.
// • minimum mark clear-space = the height of the inner square, all sides.
