export const shorthands = undefined;

// The organizations migration (1739404800000) was applied via the Postgres
// superuser over the public proxy, not the core_app role Core API actually
// connects as — core_app never inherited access to the new table, causing
// "permission denied for table organizations" on every question-feeder
// query that LEFT JOINs it (e.g. the review queue).
export const up = async (pgm) => {
  await pgm.db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON organizations TO core_app;`);
};

export const down = async (pgm) => {
  await pgm.db.query(`REVOKE SELECT, INSERT, UPDATE, DELETE ON organizations FROM core_app;`);
};
