import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { createTestMember, deleteTestMember, TestMember } from "../test-fixtures";
import { ZoneResolverService } from "./zone-resolver.service";

// Deliberately nowhere near Melukote/Kikkeri/Pandavapura (all ~12.5-12.7°N,
// 76.6°E) — this test's own centroid must never coincide with a real pilot
// zone's, or "nearest" becomes a genuine tie decided by row order, not by
// the logic under test. (An earlier version of this test picked Melukote's
// exact coordinates and broke the moment a real centroid was set there.)
const TEST_LAT = 15.4989;
const TEST_LNG = 80.05;
// New Delhi — genuinely far from every pilot zone, well past the 50km cap.
const FAR_LAT = 28.6139;
const FAR_LNG = 77.209;

describe("Geo → nearest-zone resolution (SPEC.md §35)", () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  let resolver: ZoneResolverService;
  let member: TestMember;
  let testZoneId: string;
  let questionId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
    resolver = app.get(ZoneResolverService);
    member = await createTestMember(pool, jwt);

    const { rows: zoneRows } = await pool.query<{ id: string }>(
      `INSERT INTO zones (name, level, centroid_lat, centroid_lng) VALUES ($1, 'village', $2, $3) RETURNING id`,
      [`Geo test village ${randomUUID()}`, TEST_LAT, TEST_LNG]
    );
    testZoneId = zoneRows[0].id;

    const { rows: catRows } = await pool.query<{ id: number }>(`SELECT id FROM categories WHERE slug = 'rice'`);
    const { rows: qRows } = await pool.query<{ id: number }>(
      `INSERT INTO questions (category_id, type, text_en, reward_tokens) VALUES ($1, 'numeric', $2, 3) RETURNING id`,
      [catRows[0].id, `Geo resolution test question ${randomUUID()}`]
    );
    questionId = qRows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM responses WHERE question_id = $1`, [questionId]);
    await pool.query(`DELETE FROM questions WHERE id = $1`, [questionId]);
    await deleteTestMember(pool, member.aliasId);
    await pool.query(`DELETE FROM zones WHERE id = $1`, [testZoneId]);
    await app.close();
    await pool.end();
  });

  function auth() {
    return { Authorization: `Bearer ${member.token}` };
  }

  it("resolves a reading close to a zone's centroid to that zone", async () => {
    // ~1km offset — well inside the 50km cap, and no other zone in this test
    // DB has a centroid anywhere near Melukote.
    const resolved = await resolver.resolveNearestZone(TEST_LAT + 0.01, TEST_LNG + 0.01);
    expect(resolved).toBe(testZoneId);
  });

  it("returns null for a reading far outside every zone's radius", async () => {
    const resolved = await resolver.resolveNearestZone(FAR_LAT, FAR_LNG);
    expect(resolved).toBeNull();
  });

  it("POST /v1/admin/zones stores a centroid, and PATCH corrects it", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/v1/admin/zones")
      .send({ name: `Centroid CRUD test ${randomUUID()}`, level: "village", centroidLat: 10, centroidLng: 20 });
    expect(createRes.status).toBe(201);

    const { rows: after } = await pool.query(`SELECT centroid_lat, centroid_lng FROM zones WHERE id = $1`, [
      createRes.body.id,
    ]);
    expect(Number(after[0].centroid_lat)).toBe(10);
    expect(Number(after[0].centroid_lng)).toBe(20);

    const patchRes = await request(app.getHttpServer())
      .patch(`/v1/admin/zones/${createRes.body.id}`)
      .send({ centroidLat: 11, centroidLng: 21 });
    expect(patchRes.status).toBe(200);

    const { rows: patched } = await pool.query(`SELECT centroid_lat, centroid_lng FROM zones WHERE id = $1`, [
      createRes.body.id,
    ]);
    expect(Number(patched[0].centroid_lat)).toBe(11);
    expect(Number(patched[0].centroid_lng)).toBe(21);

    await pool.query(`DELETE FROM zones WHERE id = $1`, [createRes.body.id]);
  });

  it("a Pulse answer submitted with lat/lng resolves and stores responses.zone_id — raw coordinates never persisted", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/pulse/answers")
      .set(auth())
      .send({
        answers: [
          {
            clientMsgId: randomUUID(),
            questionId,
            numericValue: 1,
            inputMode: "tap",
            language: "en",
            answeredAt: new Date().toISOString(),
            lat: TEST_LAT + 0.01,
            lng: TEST_LNG + 0.01,
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.results[0].status).toBe("credited");

    const { rows } = await pool.query<{ zone_id: string | null }>(
      `SELECT zone_id FROM responses WHERE question_id = $1 AND alias_id = $2`,
      [questionId, member.aliasId]
    );
    expect(rows[0].zone_id).toBe(testZoneId);

    // Confirm no raw-coordinate column exists on responses at all — the
    // schema itself enforces "resolved reference only," not just this test.
    const { rows: columns } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'responses' AND column_name IN ('lat', 'lng', 'latitude', 'longitude')`
    );
    expect(columns).toHaveLength(0);
  });
});
