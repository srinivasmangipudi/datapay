export const shorthands = undefined;

// SPEC.md §10 — the portal reads ONLY aggregates, enforced at the database,
// not by which queries the portal's code happens to write. No SELECT grant
// exists here for members/responses/snaps/consents/token_ledger/question_*
// — that's not an oversight, it's the point.
export const up = async (pgm) => {
  const portalPassword = process.env.CORE_PORTAL_DB_PASSWORD || "core_portal_dev_pw";
  await pgm.db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'core_portal') THEN
        CREATE ROLE core_portal WITH LOGIN PASSWORD '${portalPassword}';
      END IF;
    END
    $$;
  `);
  await pgm.db.query(`GRANT CONNECT ON DATABASE core_db TO core_portal;`);
  await pgm.db.query(`GRANT USAGE ON SCHEMA public TO core_portal;`);
  await pgm.db.query(
    `GRANT SELECT ON demand_aggregates, token_rate, zones, categories TO core_portal;`
  );
};

export const down = async (pgm) => {
  await pgm.db.query(
    `REVOKE SELECT ON demand_aggregates, token_rate, zones, categories FROM core_portal;`
  );
  await pgm.db.query(`REVOKE USAGE ON SCHEMA public FROM core_portal;`);
  await pgm.db.query(`REVOKE CONNECT ON DATABASE core_db FROM core_portal;`);
};
