import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { createTestMember, deleteTestMember, isEligibleForPulseToday, TestMember } from "../test-fixtures";

// Real seeded pilot hierarchy (infra/migrations/core/1737590400000_zones_and_members.js):
// Melukote (constituency) -> Melukote Hobli -> Kikkeri (panchayat) -> Kikkeri Village
//                          -> Pandavapura Hobli (sibling branch, no children)
const MELUKOTE_HOBLI_ID = "00000000-0000-0000-0000-000000000002";
const PANDAVAPURA_HOBLI_ID = "00000000-0000-0000-0000-000000000003";
const KIKKERI_VILLAGE_ID = "00000000-0000-0000-0000-000000000005";

describe("Pulse — questions are scoped to a member's region unless marked global (SPEC.md §23)", () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  let categoryId: number;
  let villageMember: TestMember;
  let siblingBranchMember: TestMember;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);

    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO categories (slug, name, sensitivity) VALUES ($1, 'Zone scoping test', 'standard') RETURNING id`,
      [`zone-scope-test-${randomUUID().slice(0, 8)}`]
    );
    categoryId = rows[0].id;

    // Kikkeri Village is a descendant of Melukote Hobli (via Kikkeri panchayat).
    villageMember = await createTestMember(pool, jwt, KIKKERI_VILLAGE_ID);
    // Pandavapura Hobli is a SIBLING of Melukote Hobli (both children of the
    // Melukote constituency) — the branch a Melukote-Hobli-scoped question
    // must never leak sideways into.
    siblingBranchMember = await createTestMember(pool, jwt, PANDAVAPURA_HOBLI_ID);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM responses WHERE question_id IN (SELECT id FROM questions WHERE category_id = $1)`, [categoryId]);
    await pool.query(`DELETE FROM question_options WHERE question_id IN (SELECT id FROM questions WHERE category_id = $1)`, [categoryId]);
    await pool.query(`DELETE FROM questions WHERE category_id = $1`, [categoryId]);
    await deleteTestMember(pool, villageMember.aliasId);
    await deleteTestMember(pool, siblingBranchMember.aliasId);
    await pool.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
    await app.close();
    await pool.end();
  });

  async function createQuestion(textEn: string, zoneId: string | null) {
    const res = await request(app.getHttpServer())
      .post("/v1/admin/questions")
      .send({
        categoryId,
        textEn,
        type: "yesno",
        options: [{ labelEn: "Yes" }, { labelEn: "No" }],
        zoneId: zoneId ?? undefined,
      });
    expect(res.status).toBe(201);
    return res.body.id as number;
  }

  // Not "does it win one of pulse/today's 5 rotating slots" (SPEC.md §21's
  // lesson) — real admin-authored/generated questions accumulate
  // permanently and can already fill every slot. isEligibleForPulseToday
  // checks the same WHERE clause pulse/today itself uses, LIMIT aside.

  it("a question scoped to a hobli reaches a village beneath it, but not a sibling hobli", async () => {
    const questionId = await createQuestion("Hobli-scoped question", MELUKOTE_HOBLI_ID);

    expect(await isEligibleForPulseToday(pool, villageMember.aliasId, questionId)).toBe(true);
    expect(await isEligibleForPulseToday(pool, siblingBranchMember.aliasId, questionId)).toBe(false);
  });

  it("a question scoped to the exact zone a member is in reaches that member", async () => {
    const questionId = await createQuestion("Village-scoped question", KIKKERI_VILLAGE_ID);

    expect(await isEligibleForPulseToday(pool, villageMember.aliasId, questionId)).toBe(true);
    expect(await isEligibleForPulseToday(pool, siblingBranchMember.aliasId, questionId)).toBe(false);
  });

  it("a question with no zone (global) reaches every region", async () => {
    const questionId = await createQuestion("Global question", null);

    expect(await isEligibleForPulseToday(pool, villageMember.aliasId, questionId)).toBe(true);
    expect(await isEligibleForPulseToday(pool, siblingBranchMember.aliasId, questionId)).toBe(true);
  });
});
