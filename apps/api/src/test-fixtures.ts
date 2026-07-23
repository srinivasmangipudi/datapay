import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import { Pool } from "pg";

const VILLAGE_ZONE_ID = "00000000-0000-0000-0000-000000000005";

export interface TestMember {
  aliasId: string;
  displayAlias: string;
  token: string;
}

export async function createTestMember(pool: Pool, jwt: JwtService): Promise<TestMember> {
  const aliasId = `test_${randomUUID().replace(/-/g, "")}`;
  const displayAlias = `TEST MEMBER ${aliasId.slice(-6)}`;
  await pool.query(
    `INSERT INTO members (alias_id, display_alias, zone_id) VALUES ($1, $2, $3)`,
    [aliasId, displayAlias, VILLAGE_ZONE_ID]
  );
  const token = await jwt.signAsync({ aliasId, displayAlias });
  return { aliasId, displayAlias, token };
}

export async function deleteTestMember(pool: Pool, aliasId: string): Promise<void> {
  // token_ledger rows for this alias, if any, are RESTRICTed from deletion by
  // design (§15B) — this is test data, so we just leave the ledger trail and
  // remove what CAN be cleaned up. Real member deletion is a Phase 7 concern.
  await pool.query(`DELETE FROM consents WHERE alias_id = $1`, [aliasId]);
  await pool.query(`DELETE FROM consent_events WHERE alias_id = $1`, [aliasId]);
  await pool.query(`DELETE FROM responses WHERE alias_id = $1`, [aliasId]);
  await pool.query(`DELETE FROM snaps WHERE alias_id = $1`, [aliasId]);
  await pool.query(`DELETE FROM members WHERE alias_id = $1`, [aliasId]).catch(() => {
    // has ledger rows — expected or not depending on the test; leave in place.
  });
}
