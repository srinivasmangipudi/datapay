// Single source for color/spacing/type tokens. Values are the DataPay brand
// system (SPEC.md §28, apps/assets/tokens.ts) — this file predates that
// package and had independently converged on nearly the same palette
// (ink/teal already matched exactly); brass and the tint colors below are
// now corrected to the canonical hex, not just "close."
export const colors = {
  ink: "#101418", // primary text, dark surfaces (tab bar, token card) — brand "ink"
  subtle: "#5B6672", // secondary text on light surfaces
  faint: "#9AA2AC", // tertiary text, captions, placeholders
  mist: "#8A939B", // brand's canonical secondary-text tone, where subtle/faint's two-tier split isn't needed
  onDark: "#FFFFFF",
  onDarkSubtle: "rgba(255,255,255,0.72)",
  onDarkFaint: "rgba(255,255,255,0.5)",

  paper: "#F6F5F1", // app background — brand "porcelain"
  surface: "#FFFFFF", // cards on top of paper
  border: "#E7E4DC",

  brass: "#B98F2F", // token/value accent on light surfaces — brand "brass"; value/money only, never body text
  brassOnDark: "#D4AA45", // brand "brassBright" — brass on dark
  brassTint: "#FBF2DD",

  teal: "#0E7A5C", // primary action / growth — brand "jade"
  tealDeep: "#0B6249",
  tealBright: "#12946F", // brand "jadeBright" — teal on dark
  tealSoft: "#B7D9CD", // disabled state
  tealTint: "#E3EFEA", // brand "jadeSoft" — selected-chip / highlight background

  danger: "#8C3A34",
  dangerTint: "#F3E4E2",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
} as const;

export const type = {
  caption: { fontSize: 11, letterSpacing: 0.4 },
  label: { fontSize: 12.5, letterSpacing: 1.2, textTransform: "uppercase" as const },
  small: { fontSize: 13 },
  body: { fontSize: 15 },
  subtitle: { fontSize: 17, fontWeight: "700" as const },
  title: { fontSize: 21, fontWeight: "700" as const },
  display: { fontSize: 30, fontWeight: "700" as const },
};
