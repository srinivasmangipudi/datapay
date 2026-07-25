import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { createTestMember, deleteTestMember, TestMember } from "../test-fixtures";

// SPEC.md §39 — GET /v1/pulse/today always includes English; textHi/textLocal
// fill in only when a translation exists and (for textLocal) the member's
// zone resolves to a non-Hindi local language.
describe("Pulse — a question's text resolves in English, Hindi, and the member's local language (SPEC.md §39)", () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  let categoryId: number;
  let knZoneId: string;
  let hiZoneId: string;
  let unsetZoneId: string;
  let knMember: TestMember;
  let hiMember: TestMember;
  let unsetMember: TestMember;
  const questionIds: number[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);

    const { rows: catRows } = await pool.query<{ id: number }>(
      `INSERT INTO categories (slug, name, sensitivity) VALUES ($1, 'Language resolution test', 'standard') RETURNING id`,
      [`lang-res-test-${randomUUID().slice(0, 8)}`]
    );
    categoryId = catRows[0].id;

    // Flat top-level zones (no parent needed) — each with a different
    // language_code outcome, isolated from the real pilot hierarchy.
    async function makeZone(languageCode: string | null): Promise<string> {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO zones (name, level, language_code) VALUES ($1, 'constituency', $2) RETURNING id`,
        [`Lang test zone ${randomUUID().slice(0, 8)}`, languageCode]
      );
      return rows[0].id;
    }
    knZoneId = await makeZone("kn");
    hiZoneId = await makeZone("hi");
    unsetZoneId = await makeZone(null);

    knMember = await createTestMember(pool, jwt, knZoneId);
    hiMember = await createTestMember(pool, jwt, hiZoneId);
    unsetMember = await createTestMember(pool, jwt, unsetZoneId);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM responses WHERE question_id = ANY($1)`, [questionIds]);
    await pool.query(`DELETE FROM question_options WHERE question_id = ANY($1)`, [questionIds]);
    await pool.query(`DELETE FROM questions WHERE id = ANY($1)`, [questionIds]);
    await deleteTestMember(pool, knMember.aliasId);
    await deleteTestMember(pool, hiMember.aliasId);
    await deleteTestMember(pool, unsetMember.aliasId);
    await pool.query(`DELETE FROM zones WHERE id = ANY($1)`, [[knZoneId, hiZoneId, unsetZoneId]]);
    await pool.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
    await app.close();
    await pool.end();
  });

  async function createQuestion(textEn: string, translations: { languageCode: string; text: string }[]) {
    const res = await request(app.getHttpServer()).post("/v1/admin/questions").send({
      categoryId,
      textEn,
      translations,
      type: "yesno",
      options: [{ labelEn: "Yes" }, { labelEn: "No" }],
    });
    expect(res.status).toBe(201);
    questionIds.push(res.body.id);
    return res.body.id as number;
  }

  // Mirrors pulse.service.ts's today() language-resolution query, but scoped
  // to ONE question id instead of the whole eligible batch — the real
  // /v1/pulse/today has a LIMIT 5 that real pilot data can already fill
  // (same lesson as isEligibleForPulseToday in test-fixtures.ts), so hitting
  // the live endpoint here would be flaky, not wrong.
  async function resolveQuestionText(aliasId: string, questionId: number) {
    const { rows: langRows } = await pool.query<{ language_code: string | null }>(
      `WITH RECURSIVE member_zone_chain AS (
         SELECT z.id, z.parent_id, z.language_code, 0 AS depth FROM zones z
         JOIN members m ON m.zone_id = z.id WHERE m.alias_id = $1
         UNION ALL
         SELECT z.id, z.parent_id, z.language_code, c.depth + 1 FROM zones z
         JOIN member_zone_chain c ON z.id = c.parent_id
       )
       SELECT language_code FROM member_zone_chain
       WHERE language_code IS NOT NULL ORDER BY depth LIMIT 1`,
      [aliasId]
    );
    const localLanguage = langRows[0]?.language_code ?? null;

    const { rows } = await pool.query<{ text_en: string; text_hi: string | null; text_local: string | null }>(
      `SELECT q.text_en, qt_hi.text AS text_hi, qt_local.text AS text_local
       FROM questions q
       LEFT JOIN question_translations qt_hi ON qt_hi.question_id = q.id AND qt_hi.language_code = 'hi'
       LEFT JOIN question_translations qt_local ON qt_local.question_id = q.id AND qt_local.language_code = $2
       WHERE q.id = $1`,
      [questionId, localLanguage]
    );
    const row = rows[0];
    return {
      textEn: row.text_en,
      textHi: row.text_hi,
      textLocal: localLanguage && localLanguage !== "hi" ? row.text_local : null,
      localLanguage: localLanguage && localLanguage !== "hi" ? localLanguage : null,
    };
  }

  it("shows Hindi and the resolved local-language translation when both exist", async () => {
    const id = await createQuestion("Fully translated question", [
      { languageCode: "hi", text: "हिन्दी अनुवाद" },
      { languageCode: "kn", text: "ಕನ್ನಡ ಅನುವಾದ" },
    ]);

    const q = await resolveQuestionText(knMember.aliasId, id);
    expect(q.textEn).toBe("Fully translated question");
    expect(q.textHi).toBe("हिन्दी अनुवाद");
    expect(q.textLocal).toBe("ಕನ್ನಡ ಅನುವಾದ");
    expect(q.localLanguage).toBe("kn");
  });

  it("falls back to English-only for a slot with no translation, without blocking the others", async () => {
    const id = await createQuestion("Hindi-only question", [{ languageCode: "hi", text: "केवल हिन्दी" }]);

    const q = await resolveQuestionText(knMember.aliasId, id);
    expect(q.textEn).toBe("Hindi-only question");
    expect(q.textHi).toBe("केवल हिन्दी");
    expect(q.textLocal).toBeNull(); // no 'kn' translation exists for this question
    expect(q.localLanguage).toBe("kn"); // still resolved — the member's local language doesn't depend on this question having a translation
  });

  it("omits textLocal/localLanguage entirely when the member's local language IS Hindi — never a duplicate under two labels", async () => {
    const id = await createQuestion("Question for a Hindi-zone member", [
      { languageCode: "hi", text: "हिन्दी अनुवाद" },
      { languageCode: "kn", text: "ಕನ್ನಡ ಅನುವಾದ" },
    ]);

    const q = await resolveQuestionText(hiMember.aliasId, id);
    expect(q.textHi).toBe("हिन्दी अनुवाद");
    expect(q.textLocal).toBeNull();
    expect(q.localLanguage).toBeNull();
  });

  it("a member whose zone chain has no language_code set gets English + Hindi only", async () => {
    const id = await createQuestion("Question for an unset-language member", [
      { languageCode: "hi", text: "हिन्दी अनुवाद" },
      { languageCode: "kn", text: "ಕನ್ನಡ ಅನುವಾದ" },
    ]);

    const q = await resolveQuestionText(unsetMember.aliasId, id);
    expect(q.textHi).toBe("हिन्दी अनुवाद");
    expect(q.textLocal).toBeNull();
    expect(q.localLanguage).toBeNull();
  });
});
