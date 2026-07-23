import { createHash, randomUUID } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { Pool } from "pg";

const VILLAGE_ZONE_ID = "00000000-0000-0000-0000-000000000005";

export interface TestMember {
  aliasId: string;
  displayAlias: string;
  token: string;
}

// Real alias_ids are always a 64-char HMAC-SHA256 hex digest (see
// apps/vault/src/auth/alias.util.ts) — this fixture mirrors that exact shape
// so it exercises the same validation real aliases go through, rather than a
// shorter fake format that only happens to work by accident.
export async function createTestMember(pool: Pool, jwt: JwtService): Promise<TestMember> {
  const aliasId = createHash("sha256").update(randomUUID()).digest("hex");
  const displayAlias = `TEST MEMBER ${aliasId.slice(-6)}`;
  await pool.query(
    `INSERT INTO members (alias_id, display_alias, zone_id) VALUES ($1, $2, $3)`,
    [aliasId, displayAlias, VILLAGE_ZONE_ID]
  );
  const token = await jwt.signAsync({ aliasId, displayAlias });
  return { aliasId, displayAlias, token };
}

/**
 * Cross-service tests (offers/relay) need Vault to actually know this alias
 * — createTestMember() only ever inserted into core_db. This mirrors the
 * real register→verify-otp flow's end state: a users row + a write-once
 * alias_map row in vault_db, using the SAME alias_id already used core-side.
 */
export async function registerTestMemberInVault(vaultPool: Pool, member: TestMember): Promise<void> {
  const { rows } = await vaultPool.query<{ id: string }>(
    `INSERT INTO users (phone_e164, name) VALUES ($1, 'Test Member') RETURNING id`,
    [`+91${Math.floor(7_000_000_000 + Math.random() * 999_999_999)}`]
  );
  await vaultPool.query(
    `INSERT INTO alias_map (user_id, alias_id, display_alias) VALUES ($1, $2, $3)`,
    [rows[0].id, member.aliasId, member.displayAlias]
  );
}

export async function deleteTestMemberFromVault(vaultPool: Pool, aliasId: string): Promise<void> {
  const { rows } = await vaultPool.query<{ user_id: string }>(
    `SELECT user_id FROM alias_map WHERE alias_id = $1`,
    [aliasId]
  );
  if (!rows[0]) return;
  await vaultPool.query(
    `DELETE FROM relay_map WHERE delivery_address_id IN
       (SELECT id FROM delivery_addresses WHERE user_id = $1)`,
    [rows[0].user_id]
  );
  await vaultPool.query(`DELETE FROM delivery_addresses WHERE user_id = $1`, [rows[0].user_id]);
  await vaultPool.query(`DELETE FROM alias_map WHERE alias_id = $1`, [aliasId]);
  await vaultPool.query(`DELETE FROM users WHERE id = $1`, [rows[0].user_id]);
}

/**
 * Checks the exact business rule PulseService.today() applies to a single
 * question (review_state, active window, not-already-answered-today,
 * consent) — WITHOUT that query's own `LIMIT 5`. A test asserting "this
 * question became selectable" should mean *that*, not "it happened to win
 * one of five rotating daily slots" — real admin-authored questions
 * (SPEC.md §21) accumulate permanently and can already occupy every slot
 * regardless of what any one test just did.
 */
export async function isEligibleForPulseToday(
  pool: Pool,
  aliasId: string,
  questionId: number
): Promise<boolean> {
  const { rows } = await pool.query<{ eligible: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM questions q
       WHERE q.id = $2
         AND q.review_state = 'approved'
         AND q.active_from <= now()
         AND (q.active_to IS NULL OR q.active_to > now())
         AND NOT EXISTS (
           SELECT 1 FROM responses r
           WHERE r.question_id = q.id AND r.alias_id = $1 AND r.answered_at::date = now()::date
         )
         AND NOT EXISTS (
           SELECT 1 FROM consents co
           WHERE co.category_id = q.category_id AND co.alias_id = $1 AND co.granted = false
         )
     ) AS eligible`,
    [aliasId, questionId]
  );
  return rows[0].eligible;
}

export async function deleteTestMember(pool: Pool, aliasId: string): Promise<void> {
  // token_ledger rows for this alias, if any, are RESTRICTed from deletion by
  // design (§15B) — this is test data, so we just leave the ledger trail and
  // remove what CAN be cleaned up. Real member deletion is a Phase 7 concern.
  await pool.query(`DELETE FROM consents WHERE alias_id = $1`, [aliasId]);
  await pool.query(`DELETE FROM consent_events WHERE alias_id = $1`, [aliasId]);
  await pool.query(`DELETE FROM responses WHERE alias_id = $1`, [aliasId]);
  await pool.query(`DELETE FROM snaps WHERE alias_id = $1`, [aliasId]);
  await pool.query(`DELETE FROM offer_participation WHERE alias_id = $1`, [aliasId]);
  await pool.query(`DELETE FROM intents WHERE alias_id = $1`, [aliasId]);
  await pool.query(`DELETE FROM members WHERE alias_id = $1`, [aliasId]).catch(() => {
    // has ledger rows — expected or not depending on the test; leave in place.
  });
}
