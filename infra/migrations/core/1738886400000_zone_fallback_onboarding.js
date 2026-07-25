export const shorthands = undefined;

// A member whose real village isn't in the zones tree yet still needs to be
// able to finish onboarding (SPEC.md §38) — they get assigned the nearest
// real zone as a working placeholder, flagged so ops can see it's a guess,
// not a confirmed match, and what the member actually said their area is.
export const up = (pgm) => {
  pgm.addColumn("members", {
    zone_confirmed: { type: "boolean", notNull: true, default: true },
    requested_area_note: { type: "text" },
  });
};

export const down = (pgm) => {
  pgm.dropColumn("members", ["zone_confirmed", "requested_area_note"]);
};
