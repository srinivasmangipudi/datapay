export const shorthands = undefined;

// A genuine open-ended answer type (SPEC.md §27) — distinct from §22's
// text_value, which is supplementary evidence on ANY question type. A
// free_text question's answer IS the text_value; there's no option_ids or
// numeric_value to fall back on.
export const up = (pgm) => {
  pgm.dropConstraint("questions", "questions_type_check");
  pgm.addConstraint("questions", "questions_type_check", {
    check: "type IN ('single','multi','yesno','intent_window','numeric','free_text')",
  });
};

export const down = (pgm) => {
  pgm.dropConstraint("questions", "questions_type_check");
  pgm.addConstraint("questions", "questions_type_check", {
    check: "type IN ('single','multi','yesno','intent_window','numeric')",
  });
};
