import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import {
  createTestMember,
  deleteTestMember,
  isEligibleForPulseToday,
  TestMember,
} from "../test-fixtures";

describe("Admin-authored questions skip the draft queue (SPEC.md §14/§21)", () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  let soapCategoryId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);

    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM categories WHERE slug = 'soap'`
    );
    soapCategoryId = rows[0].id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  function post(body: Record<string, unknown>) {
    return request(app.getHttpServer()).post("/v1/admin/questions").send(body);
  }

  // Every test deletes its own question(s) at the end, not in a shared
  // afterAll — accumulated approved questions eventually push past
  // pulse/today's LIMIT 5 and make the last test in this file flaky
  // (the exact bug this suite's own last test would otherwise repeat).
  async function deleteQuestion(id: number) {
    await pool.query(`DELETE FROM question_options WHERE question_id = $1`, [id]);
    await pool.query(`DELETE FROM questions WHERE id = $1`, [id]);
  }

  it("creates a 'single' question with options, approved immediately — no draft step", async () => {
    const res = await post({
      categoryId: soapCategoryId,
      textEn: "Which soap brand does your household use?",
      textKn: "ನಿಮ್ಮ ಮನೆಯಲ್ಲಿ ಯಾವ ಸಾಬೂನು ಬ್ರಾಂಡ್ ಬಳಸುತ್ತೀರಿ?",
      type: "single",
      rewardTokens: 4,
      options: [
        { labelEn: "Lifebuoy", labelKn: "ಲೈಫ್‌ಬಾಯ್" },
        { labelEn: "Lux", labelKn: "ಲಕ್ಸ್" },
        { labelEn: "Other", labelKn: "ಇತರೆ" },
      ],
    });
    expect(res.status).toBe(201);

    const { rows } = await pool.query(
      `SELECT source, review_state, type FROM questions WHERE id = $1`,
      [res.body.id]
    );
    expect(rows[0].source).toBe("admin_authored");
    expect(rows[0].review_state).toBe("approved"); // never 'draft' — authoring it IS the review

    const { rows: optRows } = await pool.query(
      `SELECT label_en FROM question_options WHERE question_id = $1 ORDER BY sort`,
      [res.body.id]
    );
    expect(optRows.map((r) => r.label_en)).toEqual(["Lifebuoy", "Lux", "Other"]);

    await deleteQuestion(res.body.id);
  });

  it("creates a 'numeric' question with no options at all", async () => {
    const res = await post({
      categoryId: soapCategoryId,
      textEn: "How many bars of soap does your household use per month?",
      type: "numeric",
      rewardTokens: 3,
    });
    expect(res.status).toBe(201);

    const { rows: optRows } = await pool.query(
      `SELECT count(*) FROM question_options WHERE question_id = $1`,
      [res.body.id]
    );
    expect(Number(optRows[0].count)).toBe(0);

    await deleteQuestion(res.body.id);
  });

  it("creates a 'free_text' question with no options at all (SPEC.md §27)", async () => {
    const res = await post({
      categoryId: soapCategoryId,
      textEn: "Why did you switch soap brands recently?",
      type: "free_text",
      rewardTokens: 3,
    });
    expect(res.status).toBe(201);

    const { rows: optRows } = await pool.query(
      `SELECT count(*) FROM question_options WHERE question_id = $1`,
      [res.body.id]
    );
    expect(Number(optRows[0].count)).toBe(0);

    await deleteQuestion(res.body.id);
  });

  it("creates an 'intent_window' question with fixed, non-admin-editable Yes/Maybe/No options", async () => {
    const res = await post({
      categoryId: soapCategoryId,
      textEn: "Do you plan to buy soap in the next month?",
      type: "intent_window",
      intentWindow: "1m",
      // Deliberately supplying different options — these must be IGNORED,
      // since intent_window's strength-detection logic depends on the exact
      // 'yes'/'maybe' label contract.
      options: [{ labelEn: "Definitely" }, { labelEn: "Nope" }],
    });
    expect(res.status).toBe(201);

    const { rows } = await pool.query(`SELECT intent_window FROM questions WHERE id = $1`, [
      res.body.id,
    ]);
    expect(rows[0].intent_window).toBe("1m");

    const { rows: optRows } = await pool.query(
      `SELECT label_en FROM question_options WHERE question_id = $1 ORDER BY sort`,
      [res.body.id]
    );
    expect(optRows.map((r) => r.label_en)).toEqual(["Yes", "Maybe", "No"]);

    await deleteQuestion(res.body.id);
  });

  it("rejects a 'single' question with fewer than 2 options", async () => {
    const res = await post({
      categoryId: soapCategoryId,
      textEn: "Broken question",
      type: "single",
      options: [{ labelEn: "Only one" }],
    });
    expect(res.status).toBe(400);
  });

  it("rejects an 'intent_window' question with no intentWindow", async () => {
    const res = await post({
      categoryId: soapCategoryId,
      textEn: "Broken intent question",
      type: "intent_window",
    });
    expect(res.status).toBe(400);
  });

  it("an admin-authored question is immediately selectable via GET /v1/pulse/today — no separate approval call needed", async () => {
    const createRes = await post({
      categoryId: soapCategoryId,
      textEn: "Do you refill soap in bulk or buy single bars?",
      type: "single",
      options: [{ labelEn: "Bulk refill" }, { labelEn: "Single bars" }],
    });
    expect(createRes.status).toBe(201);

    const member: TestMember = await createTestMember(pool, jwt);

    // Not "does it win one of pulse/today's 5 rotating slots" — real
    // admin-authored questions (SPEC.md §21) accumulate permanently (pilot
    // seed + anything created through the live portal) and can already fill
    // every slot by the time this runs. What this test actually cares about
    // is "did creating it satisfy the eligibility rule", checked directly
    // against the same WHERE clause pulse/today itself uses.
    expect(await isEligibleForPulseToday(pool, member.aliasId, createRes.body.id)).toBe(true);

    const listRes = await request(app.getHttpServer()).get(
      "/v1/admin/questions?source=admin_authored"
    );
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((q: { id: number }) => q.id === createRes.body.id)).toBe(true);

    await deleteTestMember(pool, member.aliasId);
    await deleteQuestion(createRes.body.id);
  });
});
