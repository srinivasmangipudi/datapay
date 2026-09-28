import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import {
  createTestMember,
  deleteTestMember,
  deleteTestMemberFromVault,
  registerTestMemberInVault,
  TestMember,
} from "../test-fixtures";
import { startVaultForTest, stopVaultForTest } from "../test-vault-process";
import { PushService } from "./push.service";

const VILLAGE_ZONE_ID = "00000000-0000-0000-0000-000000000005";

describe("Morning push nudge", () => {
  let app: INestApplication;
  let pool: Pool;
  let vaultPool: Pool;
  let jwt: JwtService;
  let push: PushService;
  const madeQuestionIds: number[] = [];

  beforeAll(async () => {
    await startVaultForTest();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
    push = app.get(PushService);
    vaultPool = new Pool({ connectionString: process.env.VAULT_DATABASE_URL });
  });

  afterAll(async () => {
    if (madeQuestionIds.length) {
      await pool.query(`DELETE FROM question_options WHERE question_id = ANY($1)`, [madeQuestionIds]);
      await pool.query(`DELETE FROM responses WHERE question_id = ANY($1)`, [madeQuestionIds]);
      await pool.query(`DELETE FROM questions WHERE id = ANY($1)`, [madeQuestionIds]);
    }
    await app.close();
    await pool.end();
    await vaultPool.end();
    stopVaultForTest();
  });

  async function seedAnswerableQuestion(): Promise<number> {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO questions (category_id, type, text_en, reward_tokens, review_state)
       VALUES ((SELECT id FROM categories ORDER BY id LIMIT 1), 'yesno', $1, 1, 'approved')
       RETURNING id`,
      [`push-test-${randomUUID()}`]
    );
    const id = rows[0].id;
    madeQuestionIds.push(id);
    for (const [i, label] of ["Yes", "No"].entries()) {
      await pool.query(
        `INSERT INTO question_options (question_id, label_en, sort) VALUES ($1, $2, $3)`,
        [id, label, i + 1]
      );
    }
    return id;
  }

  async function cleanup(member: TestMember) {
    await deleteTestMember(pool, member.aliasId);
    await deleteTestMemberFromVault(vaultPool, member.aliasId);
  }

  it("a member with an unanswered question is a nudge candidate; answering removes them", async () => {
    await seedAnswerableQuestion();
    const member = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);

    const before = await push.membersWithPendingQuestions();
    expect(before).toContain(member.aliasId);

    // Answer EVERY approved question, not just the seeded one. The query asks
    // "is there ANY pending question", so clearing one would leave them a
    // candidate for unrelated reasons and prove nothing.
    await pool.query(
      `INSERT INTO responses (alias_id, question_id, option_ids, input_mode, language, answered_at, client_msg_id)
       SELECT $1, q.id,
              COALESCE(ARRAY(SELECT o.id FROM question_options o WHERE o.question_id = q.id LIMIT 1), '{}'),
              'tap', 'en', now(), gen_random_uuid()
         FROM questions q
        WHERE q.review_state = 'approved'
          AND NOT EXISTS (SELECT 1 FROM responses r WHERE r.question_id = q.id AND r.alias_id = $1)`,
      [member.aliasId]
    );

    // Re-nudging someone who has already answered everything is the failure
    // this guards: a notification that opens an empty Pulse screen is worse
    // than no notification at all.
    const after = await push.membersWithPendingQuestions();
    expect(after).not.toContain(member.aliasId);

    await cleanup(member);
  });

  it("consent off-switches remove a member from the nudge entirely", async () => {
    await seedAnswerableQuestion();
    const member = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);

    // A candidate to start with — there are answerable questions for them.
    expect(await push.membersWithPendingQuestions()).toContain(member.aliasId);

    // Revoke EVERY category. Revoking just one wouldn't prove anything: the
    // query asks "is there ANY pending question", so other categories would
    // keep them a candidate for reasons unrelated to the clause under test.
    await pool.query(
      `INSERT INTO consents (alias_id, category_id, granted)
       SELECT $1, id, false FROM categories
       ON CONFLICT (alias_id, category_id) DO UPDATE SET granted = false`,
      [member.aliasId]
    );

    // The Vault off-switch is absolute — it stops questions being offered, so
    // it must stop the nudge about them too. Nudging someone who has switched
    // everything off is the worst possible notification to send.
    expect(await push.membersWithPendingQuestions()).not.toContain(member.aliasId);

    await pool.query(`DELETE FROM consents WHERE alias_id = $1`, [member.aliasId]);
    await cleanup(member);
  });

  it("registers a device token into Vault, and Core never stores it", async () => {
    const member = await createTestMember(pool, jwt, VILLAGE_ZONE_ID);
    await registerTestMemberInVault(vaultPool, member);
    const deviceToken = `test-token-${randomUUID()}`;

    const res = await request(app.getHttpServer())
      .post("/v1/me/push-token")
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ token: deviceToken, platform: "android" });
    expect(res.status).toBe(201);

    const inVault = await vaultPool.query(
      `SELECT pt.token FROM push_tokens pt
       JOIN alias_map am ON am.user_id = pt.user_id WHERE am.alias_id = $1`,
      [member.aliasId]
    );
    expect(inVault.rows).toHaveLength(1);

    // LAW 1: a device identifier is "how to reach a person" and belongs in
    // Vault. Core holding one would let a Core leak push to every member.
    const coreHasTable = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'push_tokens'`
    );
    expect(coreHasTable.rows).toHaveLength(0);

    await vaultPool.query(`DELETE FROM push_tokens WHERE token = $1`, [deviceToken]);
    await cleanup(member);
  });
});
