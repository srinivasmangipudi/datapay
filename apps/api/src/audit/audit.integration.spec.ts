import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { createTestMember, deleteTestMember, TestMember } from "../test-fixtures";

describe("Audit export (SPEC.md §12 Phase 7 / §19D)", () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  let member: TestMember;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
    member = await createTestMember(pool, jwt);

    await pool.query(
      `INSERT INTO token_ledger (alias_id, entry, tokens, ref_type, ref_id) VALUES ($1, 'earn_bonus', 7, 'audit-test', $2)`,
      [member.aliasId, `audit-test-${member.aliasId}`]
    );
  });

  afterAll(async () => {
    await deleteTestMember(pool, member.aliasId);
    await app.close();
    await pool.end();
  });

  it("returns a CSV with a header row and the seeded token_ledger entry", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/admin/audit-export")
      .query({ since: new Date(0).toISOString() });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);

    const lines = res.text.trim().split("\n");
    expect(lines[0]).toBe("source,subject_id,entry,amount,ref_type,ref_id,at");
    const row = lines.find((l) => l.includes(`audit-test-${member.aliasId}`));
    expect(row).toBeDefined();
    expect(row).toContain("token_ledger");
    expect(row).toContain(",7,"); // amount column
  });

  it("a future `since` excludes everything", async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
    const res = await request(app.getHttpServer()).get("/v1/admin/audit-export").query({ since: future });

    expect(res.status).toBe(200);
    expect(res.text.trim().split("\n")).toEqual(["source,subject_id,entry,amount,ref_type,ref_id,at"]);
  });
});
