export const shorthands = undefined;

// A plain URL as an intelligence source — no Google service account, no
// folder sharing, just paste a link (SPEC.md addendum: document-grounded
// topics were a dead end without this — the only source kind was a Drive
// folder, with no path to one from the topic wizard itself).
export const up = (pgm) => {
  pgm.dropConstraint("intelligence_sources", "intelligence_sources_kind_check");
  pgm.addConstraint("intelligence_sources", "intelligence_sources_kind_check", {
    check: "kind IN ('google_drive_folder','web_link')",
  });
};

export const down = (pgm) => {
  pgm.dropConstraint("intelligence_sources", "intelligence_sources_kind_check");
  pgm.addConstraint("intelligence_sources", "intelligence_sources_kind_check", {
    check: "kind IN ('google_drive_folder')",
  });
};
