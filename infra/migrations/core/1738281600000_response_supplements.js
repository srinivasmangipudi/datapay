export const shorthands = undefined;

// Every question can now carry supplementary answer evidence alongside its
// required structured answer (tap options / numeric value) — a free-text
// note, a transcribed-and-translated voice note (stored as text, the raw
// audio itself is still never persisted — see voice.integration.spec.ts),
// and/or an attached photo. These are additive, never a replacement for the
// question's own required answer.
export const up = (pgm) => {
  pgm.addColumns("responses", {
    text_value: { type: "text" },
    photo_storage_key: { type: "text" },
  });

  pgm.dropConstraint("responses", "responses_input_mode_check");
  pgm.addConstraint("responses", "responses_input_mode_check", {
    check: "input_mode IN ('tap','voice','snap','text')",
  });
};

export const down = (pgm) => {
  pgm.dropConstraint("responses", "responses_input_mode_check");
  pgm.addConstraint("responses", "responses_input_mode_check", {
    check: "input_mode IN ('tap','voice','snap')",
  });
  pgm.dropColumns("responses", ["text_value", "photo_storage_key"]);
};
