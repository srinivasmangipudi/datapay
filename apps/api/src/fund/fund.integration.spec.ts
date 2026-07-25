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
  deleteTestMemberFromVault,
  registerTestMemberInVault,
  TestMember,
} from "../test-fixtures";
import { startVaultForTest, stopVaultForTest } from "../test-vault-process";

const VILLAGE_ZONE_ID = "00000000-0000-0000-0000-000000000005";
// Seeded rice offer: collective 119000, market 136000 paise, 20% accrual rate.
const EXPECTED_ACCRUAL_PAISE = Math.round((136000 - 119000) * 1 * 0.2);

describe("Fund + Governance (SPEC.md §12 Phase 5)", () => {
  let app: INestApplication;
  let pool: Pool;
  let vaultPool: Pool;
  let jwt: JwtService;
  let riceOfferId: number;

  beforeAll(async () => {
    await startVaultForTest();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
    vaultPool = new Pool({ connectionString: process.env.VAULT_DATABASE_URL });

    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM offers WHERE product_code = 'rice-sona-masuri-25kg'`
    );
    riceOfferId = rows[0].id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    await vaultPool.end();
    stopVaultForTest();
  });

  async function cleanupMember(member: TestMember) {
    await deleteTestMember(pool, member.aliasId);
    await deleteTestMemberFromVault(vaultPool, member.aliasId);
  }

  async function memberWithAddress(): Promise<TestMember> {
    const member = await createTestMember(pool, jwt);
    await registerTestMemberInVault(vaultPool, member);
    await request(app.getHttpServer())
      .post("/v1/me/delivery-address")
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ address: "House 3, Kikkeri Village, Mandya 571401", zoneHint: "Kikkeri" });
    return member;
  }

  it("§15B: rejects UPDATE/DELETE on fund_ledger at the database level, even for real rupees", async () => {
    await pool.query(
      `INSERT INTO fund_ledger (zone_id, entry, amount_paise, ref_type, ref_id) VALUES ($1, 'accrual', 500, 'test-immutability', $2)`,
      [VILLAGE_ZONE_ID, `imm-${Date.now()}`]
    );
    await expect(
      pool.query(`UPDATE fund_ledger SET amount_paise = 999999 WHERE ref_type = 'test-immutability'`)
    ).rejects.toThrow(/append-only/);
    await expect(
      pool.query(`DELETE FROM fund_ledger WHERE ref_type = 'test-immutability'`)
    ).rejects.toThrow(/append-only/);
  });

  it("§12 Phase 5: fund accrues from a completed (delivered) offer", async () => {
    const member = await memberWithAddress();
    const auth = { Authorization: `Bearer ${member.token}` };

    await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/join`)
      .set(auth)
      .send({ qty: 1 });

    const before = await request(app.getHttpServer()).get("/v1/fund").set(auth);

    const confirmRes = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/confirm-delivery`)
      .set(auth);
    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.status).toBe("confirmed");
    expect(confirmRes.body.accruedPaise).toBe(EXPECTED_ACCRUAL_PAISE);

    const after = await request(app.getHttpServer()).get("/v1/fund").set(auth);
    expect(after.body.balancePaise - before.body.balancePaise).toBe(EXPECTED_ACCRUAL_PAISE);

    // idempotent: confirming again doesn't accrue a second time
    const replay = await request(app.getHttpServer())
      .post(`/v1/offers/${riceOfferId}/confirm-delivery`)
      .set(auth);
    expect(replay.body.status).toBe("already_confirmed");

    const afterReplay = await request(app.getHttpServer()).get("/v1/fund").set(auth);
    expect(afterReplay.body.balancePaise).toBe(after.body.balancePaise);

    await cleanupMember(member);
  });

  it("§12 Phase 5: one member, one vote — a second vote on the same project is rejected", async () => {
    const memberA = await memberWithAddress();
    const memberB = await memberWithAddress();

    const projectRes = await request(app.getHttpServer())
      .post("/v1/admin/fund-projects")
      .send({ zoneId: VILLAGE_ZONE_ID, title: "Streetlight repair", estimatePaise: 500000 });
    const projectId = projectRes.body.id;

    const firstVote = await request(app.getHttpServer())
      .post(`/v1/fund/projects/${projectId}/vote`)
      .set({ Authorization: `Bearer ${memberA.token}` })
      .send({ vote: "yes" });
    expect(firstVote.status).toBe(201);

    const secondMemberVote = await request(app.getHttpServer())
      .post(`/v1/fund/projects/${projectId}/vote`)
      .set({ Authorization: `Bearer ${memberB.token}` })
      .send({ vote: "no" });
    expect(secondMemberVote.status).toBe(201); // a different member — allowed

    const duplicateVote = await request(app.getHttpServer())
      .post(`/v1/fund/projects/${projectId}/vote`)
      .set({ Authorization: `Bearer ${memberA.token}` })
      .send({ vote: "no" });
    expect(duplicateVote.status).toBe(400);
    expect(JSON.stringify(duplicateVote.body)).toMatch(/one member, one vote/i);

    const { rows: voteCount } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM fund_votes WHERE project_id = $1`,
      [projectId]
    );
    expect(voteCount[0].n).toBe(2); // memberA's one vote + memberB's one vote, never 3

    // fund_votes cascades off fund_projects, so deleting the project cleans
    // up both — this test used to leave a "Streetlight repair" row behind on
    // every run (43 of them accumulated in the dev DB before this fix).
    await pool.query(`DELETE FROM fund_projects WHERE id = $1`, [projectId]);
    await cleanupMember(memberA);
    await cleanupMember(memberB);
  });
});
