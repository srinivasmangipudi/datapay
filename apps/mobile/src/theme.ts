// Single source for color/spacing/type tokens — pulled from what already
// emerged consistently across Home/Pulse/Snap/Community/Vault (dark
// near-black + gold for value + deep teal for action) rather than inventing
// a new palette. Centralizing it here so every screen stops re-deriving its
// own #8A939B/#666/#999 soup of near-identical grays.
export const colors = {
  ink: "#101418", // primary text, dark surfaces (tab bar, token card)
  subtle: "#5B6672", // secondary text on light surfaces
  faint: "#9AA2AC", // tertiary text, captions, placeholders
  onDark: "#FFFFFF",
  onDarkSubtle: "rgba(255,255,255,0.72)",
  onDarkFaint: "rgba(255,255,255,0.5)",

  paper: "#FBFAF7", // app background — warm off-white, not stark white
  surface: "#FFFFFF", // cards on top of paper
  border: "#E7E4DC",

  brass: "#C99A2E", // token/value accent on light surfaces
  brassOnDark: "#D4AA45", // lighter variant reads better on dark surfaces
  brassTint: "#FBF2DD",

  teal: "#0E7A5C", // primary action / growth
  tealDeep: "#0B6249",
  tealSoft: "#B7D9CD", // disabled state
  tealTint: "#E4F2ED", // selected-chip / highlight background

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
