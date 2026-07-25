import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { createTestMember, deleteTestMember, TestMember } from "../test-fixtures";
import type { GeocodedPlace, GeocodingProvider } from "./geocoding.provider";
import { ZoneGeocodingService } from "./zone-geocoding.service";

// Nowhere near Melukote/Kikkeri/Pandavapura (all ~12.5-12.7°N, 76.6°E) — same
// lesson as §35/§38's other geo tests: a fake reading must never coincide
// with real pilot centroids.
const TEST_LAT = 19.076;
const TEST_LNG = 72.8777;

class FakeGeocodingProvider implements GeocodingProvider {
  constructor(private readonly place: GeocodedPlace | null) {}
  async reverseGeocode(): Promise<GeocodedPlace | null> {
    return this.place;
  }
  async forwardGeocode(): Promise<GeocodedPlace | null> {
    return this.place;
  }
}

describe("Onboarding fallback: geocode → find-or-create REGION, then VILLAGE inside it (SPEC.md §38)", () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  let member: TestMember;
  let geocoding: ZoneGeocodingService;
  let existingRegionName: string;
  let existingRegionId: string;
  let existingVillageId: string;
  let existingVillageName: string;
  const createdZoneIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    jwt = app.get(JwtService);
    geocoding = app.get(ZoneGeocodingService);
    member = await createTestMember(pool, jwt);

    existingRegionName = `Fallback Test District ${randomUUID().slice(0, 8)}`;
    existingVillageName = `Existing fallback village ${randomUUID().slice(0, 8)}`;
    const { rows: regionRows } = await pool.query<{ id: string }>(
      `INSERT INTO zones (name, level, centroid_lat, centroid_lng) VALUES ($1, 'constituency', $2, $3) RETURNING id`,
      [existingRegionName, TEST_LAT + 0.5, TEST_LNG + 0.5]
    );
    existingRegionId = regionRows[0].id;

    const { rows: villageRows } = await pool.query<{ id: string }>(
      `INSERT INTO zones (name, level, parent_id, centroid_lat, centroid_lng) VALUES ($1, 'village', $2, $3, $4) RETURNING id`,
      [existingVillageName, existingRegionId, TEST_LAT, TEST_LNG]
    );
    existingVillageId = villageRows[0].id;
  });

  afterAll(async () => {
    await deleteTestMember(pool, member.aliasId);
    await pool.query(`DELETE FROM zones WHERE id = ANY($1)`, [
      [...createdZoneIds, existingVillageId, existingRegionId],
    ]);
    await app.close();
    await pool.end();
  });

  afterEach(() => {
    geocoding.geocoderOverride = null;
  });

  function auth() {
    return { Authorization: `Bearer ${member.token}` };
  }

  it("requires auth", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/zones/resolve-location")
      .send({ lat: TEST_LAT, lng: TEST_LNG });
    expect(res.status).toBe(401);
  });

  it("matches an existing region BY NAME (never by distance) and an existing village inside it", async () => {
    geocoding.geocoderOverride = new FakeGeocodingProvider({
      placeName: existingVillageName,
      regionName: existingRegionName,
      state: "Test State",
      displayName: `${existingVillageName}, ${existingRegionName}, Test State`,
      lat: TEST_LAT,
      lng: TEST_LNG,
    });

    const res = await request(app.getHttpServer())
      .post("/v1/zones/resolve-location")
      .set(auth())
      .send({ lat: TEST_LAT, lng: TEST_LNG });

    expect(res.status).toBe(201);
    expect(res.body.matchType).toBe("existing");
    expect(res.body.zone.id).toBe(existingVillageId);
    expect(res.body.zone.parentId).toBe(existingRegionId);
  });

  it("creates a brand-new region AND village when neither exists — never force-attaches to an unrelated existing region", async () => {
    const newRegionName = `Brand new region ${randomUUID().slice(0, 8)}`;
    const newPlaceName = `Brand new village ${randomUUID().slice(0, 8)}`;
    // Deliberately close to the EXISTING region's centroid — proving
    // proximity is irrelevant now; only the region NAME decides the match.
    geocoding.geocoderOverride = new FakeGeocodingProvider({
      placeName: newPlaceName,
      regionName: newRegionName,
      state: "Test State",
      displayName: `${newPlaceName}, ${newRegionName}, Test State`,
      lat: TEST_LAT + 0.001,
      lng: TEST_LNG + 0.001,
    });

    const res = await request(app.getHttpServer())
      .post("/v1/zones/resolve-location")
      .set(auth())
      .send({ lat: TEST_LAT + 0.001, lng: TEST_LNG + 0.001 });

    expect(res.status).toBe(201);
    expect(res.body.matchType).toBe("created");
    expect(res.body.zone.name).toBe(newPlaceName);
    expect(res.body.zone.parentId).not.toBe(existingRegionId); // NOT force-attached to the nearby existing region
    createdZoneIds.push(res.body.zone.id, res.body.zone.parentId);

    const { rows: regionRows } = await pool.query<{ name: string; needs_hierarchy_review: boolean }>(
      `SELECT name, needs_hierarchy_review FROM zones WHERE id = $1`,
      [res.body.zone.parentId]
    );
    expect(regionRows[0].name).toBe(newRegionName);
    expect(regionRows[0].needs_hierarchy_review).toBe(true);
  });

  it("a same-named village in a DIFFERENT region does not collide with the existing one", async () => {
    const newRegionName = `Another region ${randomUUID().slice(0, 8)}`;
    geocoding.geocoderOverride = new FakeGeocodingProvider({
      placeName: existingVillageName, // same village NAME as the seeded one
      regionName: newRegionName, // but a different real region
      state: "Test State",
      displayName: `${existingVillageName}, ${newRegionName}, Test State`,
      lat: TEST_LAT + 5,
      lng: TEST_LNG + 5,
    });

    const res = await request(app.getHttpServer())
      .post("/v1/zones/resolve-location")
      .set(auth())
      .send({ lat: TEST_LAT + 5, lng: TEST_LNG + 5 });

    expect(res.status).toBe(201);
    expect(res.body.matchType).toBe("created"); // a NEW village, not the existing one
    expect(res.body.zone.id).not.toBe(existingVillageId);
    expect(res.body.zone.name).toBe(existingVillageName);
    expect(res.body.zone.parentId).not.toBe(existingRegionId);
    createdZoneIds.push(res.body.zone.id, res.body.zone.parentId);
  });

  it("400s when the geocoder can't resolve a place name", async () => {
    geocoding.geocoderOverride = new FakeGeocodingProvider({
      placeName: null,
      regionName: existingRegionName,
      state: "Test State",
      displayName: "Somewhere unspecific",
      lat: TEST_LAT,
      lng: TEST_LNG,
    });

    const res = await request(app.getHttpServer())
      .post("/v1/zones/resolve-location")
      .set(auth())
      .send({ lat: TEST_LAT, lng: TEST_LNG });
    expect(res.status).toBe(400);
  });

  it("400s when the geocoder can't resolve a region name", async () => {
    geocoding.geocoderOverride = new FakeGeocodingProvider({
      placeName: "Some Village",
      regionName: null,
      state: "Test State",
      displayName: "Somewhere unspecific",
      lat: TEST_LAT,
      lng: TEST_LNG,
    });

    const res = await request(app.getHttpServer())
      .post("/v1/zones/resolve-location")
      .set(auth())
      .send({ lat: TEST_LAT, lng: TEST_LNG });
    expect(res.status).toBe(400);
  });

  it("resolves a typed address the same way (forward geocode)", async () => {
    const newRegionName = `Address region ${randomUUID().slice(0, 8)}`;
    const newPlaceName = `Address-entered village ${randomUUID().slice(0, 8)}`;
    geocoding.geocoderOverride = new FakeGeocodingProvider({
      placeName: newPlaceName,
      regionName: newRegionName,
      state: "Test State",
      displayName: `${newPlaceName}, ${newRegionName}, Test State`,
      lat: TEST_LAT + 0.02,
      lng: TEST_LNG + 0.02,
    });

    const res = await request(app.getHttpServer())
      .post("/v1/zones/resolve-location")
      .set(auth())
      .send({ address: "some house near the market, test village" });

    expect(res.status).toBe(201);
    expect(res.body.matchType).toBe("created");
    expect(res.body.zone.name).toBe(newPlaceName);
    createdZoneIds.push(res.body.zone.id, res.body.zone.parentId);
  });

  it("PUT /v1/me persists zoneConfirmed: false and a requestedAreaNote", async () => {
    const res = await request(app.getHttpServer())
      .put("/v1/me")
      .set(auth())
      .send({
        zoneId: existingVillageId,
        locale: "kn",
        zoneConfirmed: false,
        requestedAreaNote: "Hosahalli, near the old temple",
      });
    expect(res.status).toBe(200);
    expect(res.body.zoneConfirmed).toBe(false);
    expect(res.body.requestedAreaNote).toBe("Hosahalli, near the old temple");

    const getRes = await request(app.getHttpServer()).get("/v1/me").set(auth());
    expect(getRes.body.zoneConfirmed).toBe(false);
    expect(getRes.body.requestedAreaNote).toBe("Hosahalli, near the old temple");
  });

  it("PUT /v1/me defaults zoneConfirmed to true when omitted (the normal, non-fallback path)", async () => {
    const res = await request(app.getHttpServer())
      .put("/v1/me")
      .set(auth())
      .send({ zoneId: existingVillageId, locale: "kn" });
    expect(res.status).toBe(200);
    expect(res.body.zoneConfirmed).toBe(true);
    expect(res.body.requestedAreaNote).toBeNull();
  });
});
