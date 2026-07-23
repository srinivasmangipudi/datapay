export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable("buyer_directory", {
    id: { type: "serial", primaryKey: true },
    kind: {
      type: "text",
      notNull: true,
      check:
        "kind IN ('internal_collective','local_processor','institutional','external_trader','retail_chain')",
    },
    zone_id: { type: "uuid", references: "zones", onDelete: "set null" },
    produce_category_ids: { type: "integer[]", notNull: true },
    verified: { type: "boolean", notNull: true, default: false },
    contact_ref: { type: "text" },
  });

  // Progressive identity disclosure (§8 screen 5): identity_disclosed_at stays
  // NULL through suggested/interested/negotiating — only the 'agreed'
  // transition (member's explicit "Reveal & proceed") ever sets it.
  pgm.createTable("linkages", {
    id: { type: "serial", primaryKey: true },
    listing_id: { type: "integer", notNull: true, references: "produce_listings", onDelete: "cascade" },
    buyer_id: { type: "integer", notNull: true, references: "buyer_directory", onDelete: "restrict" },
    proposed_price_paise: { type: "integer", notNull: true },
    distance_km: { type: "numeric" },
    state: {
      type: "text",
      notNull: true,
      default: "suggested",
      check:
        "state IN ('suggested','producer_interested','negotiating','agreed','completed','declined')",
    },
    identity_disclosed_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("linkages", "listing_id");

  pgm.createTable("valueadd_suggestions", {
    id: { type: "serial", primaryKey: true },
    produce_category_id: { type: "integer", notNull: true, references: "produce_categories", onDelete: "cascade" },
    suggestion_en: { type: "text", notNull: true },
    suggestion_kn: { type: "text" },
    uplift_note: { type: "text" },
    source: { type: "text", notNull: true, default: "library", check: "source IN ('library','llm_generated','ops_curated')" },
    approved: { type: "boolean", notNull: true, default: true },
  });
  pgm.createIndex("valueadd_suggestions", "produce_category_id");

  // Not a ledger — a payout ATTEMPT record. UNIQUE(linkage_id) is the
  // idempotency guard: retrying a payout run never pays the same deal twice.
  pgm.createTable("producer_payouts", {
    id: { type: "serial", primaryKey: true },
    alias_id: { type: "text", notNull: true, references: "producer_profiles", onDelete: "restrict" },
    linkage_id: { type: "integer", notNull: true, references: "linkages", onDelete: "restrict" },
    amount_paise: { type: "integer", notNull: true },
    status: { type: "text", notNull: true, default: "pending", check: "status IN ('pending','processing','paid','failed')" },
    upi_ref: { type: "text" },
    initiated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("producer_payouts", "producer_payouts_linkage_unique", {
    unique: ["linkage_id"],
  });
};

export const down = (pgm) => {
  pgm.dropTable("producer_payouts");
  pgm.dropTable("valueadd_suggestions");
  pgm.dropTable("linkages");
  pgm.dropTable("buyer_directory");
};
