export const shorthands = undefined;

// question_stat_aggregates was UNIQUE (question_id, zone_id, window), and the
// aggregation job upserted into it — so every hourly run overwrote the previous
// answer distribution and only the latest snapshot ever survived.
//
// demand_aggregates, right next to it, has always been a plain append and is a
// real time series. The inconsistency was silent: nothing was "purged", the
// history simply never accumulated. How a zone's answers SHIFT over time is the
// signal worth training on — a single current snapshot can't show a trend.
//
// Dropping the unique constraint turns the same INSERT into an append. The
// index is kept (without uniqueness) because every read filters on these three
// columns and now has more rows to filter through, not fewer.
export const up = (pgm) => {
  pgm.dropConstraint("question_stat_aggregates", "question_stat_aggregates_unique", {
    ifExists: true,
  });
  pgm.createIndex("question_stat_aggregates", ["question_id", "zone_id", "window"], {
    name: "question_stat_aggregates_lookup",
    ifNotExists: true,
  });
};

export const down = (pgm) => {
  pgm.dropIndex("question_stat_aggregates", ["question_id", "zone_id", "window"], {
    name: "question_stat_aggregates_lookup",
    ifExists: true,
  });
  // Deliberately not restoring the UNIQUE constraint: by now there are
  // legitimately multiple rows per (question, zone, window) and re-adding it
  // would fail. Collapsing to the latest row per group first would destroy the
  // history this migration exists to keep, so that is left as a manual
  // decision rather than something a `down` does silently.
};
