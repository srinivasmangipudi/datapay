export const shorthands = undefined;

// The public demand registry's second half (SPEC.md §43): product demand and
// non-product community signals, both published per question × zone, both
// gated by the same LAW 3 floor — which becomes runtime-configurable here
// without ever ceasing to be enforced at the database.
export const up = (pgm) => {
  // --- 1. LAW 3's floor: still enforced in the DB, no longer hardcoded ------
  //
  // demand_aggregates.cohort_size carried `CHECK (cohort_size >= 50)`. A CHECK
  // can only reference the row, so a configurable floor can't live in one.
  // A BEFORE INSERT/UPDATE trigger reading a single settings row can — and is
  // strictly stronger than the CHECK it replaces, because it also covers the
  // two new tables below and can be raised above 50 without a migration.
  pgm.createTable("system_settings", {
    id: { type: "integer", primaryKey: true, default: 1, check: "id = 1" },
    k_anon_floor: { type: "integer", notNull: true, default: 50, check: "k_anon_floor >= 1" },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.sql(`INSERT INTO system_settings (id, k_anon_floor) VALUES (1, 50)`);

  pgm.sql(`
    CREATE FUNCTION enforce_k_anon_floor() RETURNS trigger AS $$
    DECLARE floor_value integer;
    BEGIN
      SELECT k_anon_floor INTO floor_value FROM system_settings WHERE id = 1;
      -- No settings row => fall back to LAW 3's production value, never to
      -- "no floor at all". Same fail-closed posture as resolveKAnonFloor().
      IF floor_value IS NULL THEN floor_value := 50; END IF;
      IF NEW.cohort_size < floor_value THEN
        RAISE EXCEPTION 'LAW 3: cohort_size % is below the k-anonymity floor of %',
          NEW.cohort_size, floor_value;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.dropConstraint("demand_aggregates", "demand_aggregates_cohort_size_check");
  pgm.sql(`
    CREATE TRIGGER demand_aggregates_k_anon
      BEFORE INSERT OR UPDATE ON demand_aggregates
      FOR EACH ROW EXECUTE FUNCTION enforce_k_anon_floor();
  `);

  // --- 2. The two buckets, declared not inferred ---------------------------
  //
  // "Rice" is a product category; "health" and "free time" are not. Nothing in
  // the existing schema distinguishes them: products.category_id is populated
  // for exactly one category, and zero question_options carry a product_code,
  // so both available inference signals are empty. An explicit column is the
  // only honest way to split the registry in two.
  pgm.addColumns("categories", {
    kind: {
      type: "text",
      notNull: true,
      default: "product",
      check: "kind IN ('product','topic')",
    },
    // Defaults to FALSE, deliberately: integration tests create throwaway
    // categories on every run (zone scoping, k-anon, language resolution), and
    // an ops admin can create one inline from a wizard. Defaulting to true
    // would put every one of those on a public page the moment it had enough
    // answers. A category reaches the public registry only because someone
    // said so — the real ones are turned on explicitly just below.
    published: { type: "boolean", notNull: true, default: false },
  });

  pgm.sql(`UPDATE categories SET kind = 'topic' WHERE slug IN ('health','free-time')`);
  // The categories that exist today and are real — everything else already
  // defaults to unpublished, including the three test-fixture families
  // (zone-scope-test-*, kanon-test-*, lang-res-test-*) currently in this table.
  pgm.sql(`
    UPDATE categories SET published = true
    WHERE slug IN (
      'rice','sugar','cooking-oil','soap','toothpaste','flour','pulses',
      'vegetables','organic-produce','dairy','spices','tea-coffee',
      'health','free-time'
    )
  `);

  // --- 3. Per-question published stats -------------------------------------
  //
  // One table serves BOTH public buckets: a row's bucket is its question's
  // category.kind, resolved at read time. Product demand and community signals
  // are the same computation over the same responses — only the subject
  // differs — so giving them separate tables would duplicate the aggregation
  // and let the two drift apart on exactly the constraint that matters most.
  pgm.createTable("question_stat_aggregates", {
    id: { type: "serial", primaryKey: true },
    question_id: { type: "integer", notNull: true, references: "questions", onDelete: "cascade" },
    zone_id: { type: "uuid", notNull: true, references: "zones", onDelete: "restrict" },
    window: { type: "text", notNull: true, default: "rolling" },
    // Shape depends on the question type — see AggregationService.computeQuestionStat():
    //   options : { kind:'options', total, options:[{ label, count, pct }] }
    //   numeric : { kind:'numeric', count, mean, median, min, max }
    // free_text questions are never aggregated here at all (see the service).
    distribution: { type: "jsonb", notNull: true },
    cohort_size: { type: "integer", notNull: true },
    computed_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("question_stat_aggregates", ["question_id", "zone_id"]);
  pgm.createIndex("question_stat_aggregates", "computed_at");
  // A question × zone × window has exactly one current published stat — the
  // aggregation job upserts onto this, so re-running it refreshes rather than
  // accumulating a new historical row every hour (which is what
  // demand_aggregates does, and why that table grows unboundedly).
  pgm.addConstraint("question_stat_aggregates", "question_stat_aggregates_unique", {
    unique: ["question_id", "zone_id", "window"],
  });
  pgm.sql(`
    CREATE TRIGGER question_stat_aggregates_k_anon
      BEFORE INSERT OR UPDATE ON question_stat_aggregates
      FOR EACH ROW EXECUTE FUNCTION enforce_k_anon_floor();
  `);

  // Defensive, for the same reason 1739491200000 and 1739750400000 exist:
  // when these tables get created by a superuser rather than by core_app,
  // core_app inherits nothing and every query fails with "permission denied".
  // A no-op when core_app already owns them, which is the normal case.
  pgm.sql(`GRANT SELECT, INSERT, UPDATE, DELETE ON question_stat_aggregates TO core_app;`);
  pgm.sql(`GRANT SELECT, INSERT, UPDATE, DELETE ON system_settings TO core_app;`);
  pgm.sql(`GRANT USAGE, SELECT ON SEQUENCE question_stat_aggregates_id_seq TO core_app;`);
};

export const down = (pgm) => {
  pgm.dropTable("question_stat_aggregates");
  pgm.dropColumns("categories", ["kind", "published"]);
  pgm.sql(`DROP TRIGGER demand_aggregates_k_anon ON demand_aggregates`);
  pgm.addConstraint("demand_aggregates", "demand_aggregates_cohort_size_check", {
    check: "cohort_size >= 50",
  });
  pgm.sql(`DROP FUNCTION enforce_k_anon_floor()`);
  pgm.dropTable("system_settings");
};
