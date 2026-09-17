export const shorthands = undefined;

// Same bug as 1739491200000 (organizations): these tables were created via
// the Postgres superuser, not the core_app role Core API actually connects
// as — core_app never inherited access, causing "permission denied" on
// every query. Sequences need their own explicit grant too (core_app isn't
// the owner, so it doesn't inherit nextval()/currval() access from the
// table grant alone).
export const up = async (pgm) => {
  await pgm.db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON org_products TO core_app;`);
  await pgm.db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON org_product_import_runs TO core_app;`);
  await pgm.db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON product_orders TO core_app;`);
  await pgm.db.query(`GRANT USAGE, SELECT ON SEQUENCE org_products_id_seq TO core_app;`);
  await pgm.db.query(`GRANT USAGE, SELECT ON SEQUENCE org_product_import_runs_id_seq TO core_app;`);
  await pgm.db.query(`GRANT USAGE, SELECT ON SEQUENCE product_orders_id_seq TO core_app;`);
};

export const down = async (pgm) => {
  await pgm.db.query(`REVOKE SELECT, INSERT, UPDATE, DELETE ON org_products FROM core_app;`);
  await pgm.db.query(`REVOKE SELECT, INSERT, UPDATE, DELETE ON org_product_import_runs FROM core_app;`);
  await pgm.db.query(`REVOKE SELECT, INSERT, UPDATE, DELETE ON product_orders FROM core_app;`);
  await pgm.db.query(`REVOKE USAGE, SELECT ON SEQUENCE org_products_id_seq FROM core_app;`);
  await pgm.db.query(`REVOKE USAGE, SELECT ON SEQUENCE org_product_import_runs_id_seq FROM core_app;`);
  await pgm.db.query(`REVOKE USAGE, SELECT ON SEQUENCE product_orders_id_seq FROM core_app;`);
};
