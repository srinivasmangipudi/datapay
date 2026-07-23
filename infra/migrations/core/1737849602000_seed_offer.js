export const shorthands = undefined;

const VILLAGE_ZONE_ID = "00000000-0000-0000-0000-000000000005";

export const up = async (pgm) => {
  await pgm.db.query(
    `INSERT INTO brands (brand_code, display_name) VALUES ('ravi-rice-mills', 'Ravi Rice Mills')`
  );

  const { rows: rice } = await pgm.db.query(`SELECT id FROM categories WHERE slug = 'rice'`);
  await pgm.db.query(
    `INSERT INTO products (product_code, category_id, display_name, display_name_kn, brand_code, unit_spec, mrp_paise)
     VALUES ('rice-sona-masuri-25kg', $1, 'Sona Masuri Rice, 25kg', 'ಸೋನಾ ಮಸೂರಿ ಅಕ್ಕಿ, 25 ಕೆಜಿ', 'ravi-rice-mills', '25kg bag', 136000)`,
    [rice[0].id]
  );

  const { rows: node } = await pgm.db.query(
    `INSERT INTO pacs_nodes (zone_id, kind, name, godown_capacity_note, active)
     VALUES ($1, 'pacs', 'Kikkeri PACS', '~200 bags dry storage', true) RETURNING id`,
    [VILLAGE_ZONE_ID]
  );

  const { rows: offer } = await pgm.db.query(
    `INSERT INTO offers
       (product_code, zone_id, pacs_node_id, collective_price_paise, market_price_paise,
        min_participants, closes_at, status, brand_code)
     VALUES ('rice-sona-masuri-25kg', $1, $2, 119000, 136000, 50, now() + interval '14 days', 'open', 'ravi-rice-mills')
     RETURNING id`,
    [VILLAGE_ZONE_ID, node[0].id]
  );

  await pgm.db.query(
    `INSERT INTO offer_token_terms (offer_id, max_tokens_redeemable, token_value_paise, set_by)
     VALUES ($1, 350, 24, 'seed')`,
    [offer[0].id]
  );
};

export const down = async (pgm) => {
  await pgm.db.query(`DELETE FROM offer_token_terms WHERE set_by = 'seed'`);
  await pgm.db.query(`DELETE FROM offers WHERE product_code = 'rice-sona-masuri-25kg'`);
  await pgm.db.query(`DELETE FROM pacs_nodes WHERE name = 'Kikkeri PACS'`);
  await pgm.db.query(`DELETE FROM products WHERE product_code = 'rice-sona-masuri-25kg'`);
  await pgm.db.query(`DELETE FROM brands WHERE brand_code = 'ravi-rice-mills'`);
};
