export const shorthands = undefined;

const VILLAGE_ZONE_ID = "00000000-0000-0000-0000-000000000005";

const CATEGORIES = [
  { slug: "sugarcane", name: "Sugarcane", name_kn: "ಕಬ್ಬು", unit: "quintal" },
  { slug: "paddy", name: "Paddy", name_kn: "ಭತ್ತ", unit: "quintal" },
  { slug: "ragi", name: "Ragi", name_kn: "ರಾಗಿ", unit: "kg" },
  { slug: "milk", name: "Milk", name_kn: "ಹಾಲು", unit: "litre" },
  { slug: "coconut", name: "Coconut", name_kn: "ತೆಂಗಿನಕಾಯಿ", unit: "piece" },
  { slug: "shg-textiles", name: "SHG woven textiles", name_kn: "ನೇಯ್ಗೆ ಉತ್ಪನ್ನಗಳು", unit: "piece" },
];

// SPEC.md §12 Phase 6: "value-add suggestion library (seed ~20 for Mandya
// produce)". Real, specific suggestions, not placeholders — these are the
// same kind of concrete uplift ideas the pitch deck's SHG example describes.
const SUGGESTIONS = {
  sugarcane: [
    ["Process into jaggery (bella) instead of selling raw cane — 2-3x price uplift as a health-food sugar alternative.", "raw cane -> jaggery"],
    ["Contract a fixed off-take with a nearby jaggery unit instead of spot-selling to the mill.", "price stability"],
    ["Bottle sugarcane juice for local sale in peak season — near-zero processing cost.", "seasonal margin"],
    ["Sell green cane tops as fodder instead of burning post-harvest.", "waste -> income"],
  ],
  paddy: [
    ["Mill in small batches and sell as branded local rice instead of raw paddy — captures the milling margin.", "milling margin"],
    ["Sell rice bran and husk to oil mills and brick kilns instead of discarding.", "byproduct income"],
    ["Grow a traditional variety (e.g. Rajamudi) for premium urban buyers.", "premium variety"],
    ["Compost paddy straw instead of burning — sell as organic compost to nearby vegetable farms.", "waste -> compost"],
  ],
  ragi: [
    ["Process into ragi malt/flour instead of selling raw grain — strong urban health-food premium.", "raw grain -> malt"],
    ["Package as a direct-to-consumer health mix via the collective.", "D2C packaging"],
    ["Sell ragi husk/straw as cattle fodder instead of burning it.", "waste -> fodder"],
  ],
  milk: [
    ["Convert surplus milk to curd/paneer in low-demand hours instead of distress-selling.", "surplus conversion"],
    ["Join a bulk milk chilling unit to reduce spoilage and access better per-litre rates.", "spoilage reduction"],
    ["Produce ghee in small batches — 3-4x price uplift over raw milk.", "raw milk -> ghee"],
  ],
  coconut: [
    ["Sell coconut water separately from copra — growing urban premium market.", "separate revenue stream"],
    ["Process husk into coir for local handicraft units instead of discarding.", "waste -> coir"],
    ["Cold-press coconut oil locally instead of selling raw copra to a mill.", "copra -> cold-press oil"],
  ],
  "shg-textiles": [
    ["Add a cotton lining and printed tag — urban craft stores pay up to 3x the local rate.", "urban craft premium"],
    ["Bundle woven products into festival-season gift sets for urban sale.", "seasonal bundling"],
    ["Get a GI/handloom certification to access government procurement and export channels.", "certification access"],
  ],
};

export const up = async (pgm) => {
  const categoryIds = {};
  for (const c of CATEGORIES) {
    const { rows } = await pgm.db.query(
      `INSERT INTO produce_categories (slug, name, name_kn, unit) VALUES ($1, $2, $3, $4) RETURNING id`,
      [c.slug, c.name, c.name_kn, c.unit]
    );
    categoryIds[c.slug] = rows[0].id;
  }

  for (const [slug, suggestions] of Object.entries(SUGGESTIONS)) {
    for (const [suggestionEn, upliftNote] of suggestions) {
      await pgm.db.query(
        `INSERT INTO valueadd_suggestions (produce_category_id, suggestion_en, uplift_note, source, approved)
         VALUES ($1, $2, $3, 'library', true)`,
        [categoryIds[slug], suggestionEn, upliftNote]
      );
    }
  }

  const allCategoryIds = Object.values(categoryIds);
  await pgm.db.query(
    `INSERT INTO buyer_directory (kind, zone_id, produce_category_ids, verified, contact_ref)
     VALUES ('internal_collective', NULL, $1, true, 'DataPay Melukote Collective')`,
    [allCategoryIds]
  );
  await pgm.db.query(
    `INSERT INTO buyer_directory (kind, zone_id, produce_category_ids, verified, contact_ref)
     VALUES ('local_processor', $1, $2, true, 'Kikkeri Jaggery Unit')`,
    [VILLAGE_ZONE_ID, [categoryIds.sugarcane]]
  );
  await pgm.db.query(
    `INSERT INTO buyer_directory (kind, zone_id, produce_category_ids, verified, contact_ref)
     VALUES ('institutional', NULL, $1, true, 'Karnataka Milk Federation (KMF)')`,
    [[categoryIds.milk]]
  );
  await pgm.db.query(
    `INSERT INTO buyer_directory (kind, zone_id, produce_category_ids, verified, contact_ref)
     VALUES ('external_trader', NULL, $1, false, 'Regional ragi trader')`,
    [[categoryIds.ragi]]
  );
};

export const down = async (pgm) => {
  await pgm.db.query(`DELETE FROM buyer_directory`);
  await pgm.db.query(`DELETE FROM valueadd_suggestions`);
  await pgm.db.query(
    `DELETE FROM produce_categories WHERE slug = ANY($1)`,
    [CATEGORIES.map((c) => c.slug)]
  );
};
