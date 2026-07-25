import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { createTestMember, deleteTestMember, TestMember } from "../test-fixtures";
import { SnapsService } from "./snaps.service";
import type { CategoryOption, SnapRecognition, VisionProvider } from "./vision.provider";

class FakeVisionProvider implements VisionProvider {
  async analyze(_imageBase64: string, categories: CategoryOption[]): Promise<SnapRecognition> {
    const rice = categories.find((c) => c.slug === "rice");
    return {
      tags: ["rice", "5kg bag", "branded package"],
      label: "5kg rice bag",
      confidence: 0.9,
      productGuess: "India Gate Rice",
      categorySlug: rice?.slug ?? null,
    };
  }
}

describe("Snaps — atomic + idempotent token earning (SPEC.md §15A/§15C)", () => {
  let app: INestApplication;
  let pool: Pool;
  let member: TestMember;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    const jwt = app.get(JwtService);
    member = await createTestMember(pool, jwt);
    // Real Gemini calls would be slow and non-deterministic in CI — same
    // override seam as TranslationService.translationOverride.
    app.get(SnapsService).recognitionOverride = new FakeVisionProvider();
  });

  afterAll(async () => {
    await deleteTestMember(pool, member.aliasId);
    await app.close();
    await pool.end();
  });

  function auth() {
    return { Authorization: `Bearer ${member.token}` };
  }

  it("credits tokens on first submission and lists the snap", async () => {
    const before = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    const clientMsgId = randomUUID();

    const res = await request(app.getHttpServer()).post("/v1/snaps").set(auth()).send({
      clientMsgId,
      imageBase64: Buffer.from("fake-jpeg-bytes").toString("base64"),
      capturedAt: new Date().toISOString(),
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("credited");

    const after = await pool.query<{ token_balance: number }>(
      `SELECT token_balance FROM members WHERE alias_id = $1`,
      [member.aliasId]
    );
    expect(after.rows[0].token_balance).toBeGreaterThan(before.rows[0].token_balance);

    const list = await request(app.getHttpServer()).get("/v1/snaps").set(auth());
    expect(list.body.some((s: { id: number }) => s.id === res.body.snapId)).toBe(true);
  });

  it("replaying the same client_msg_id is a clean no-op", async () => {
    const clientMsgId = randomUUID();
    const payload = {
      clientMsgId,
      imageBase64: Buffer.from("fake-jpeg-bytes-2").toString("base64"),
      capturedAt: new Date().toISOString(),
    };

    const first = await request(app.getHttpServer()).post("/v1/snaps").set(auth()).send(payload);
    expect(first.body.status).toBe("credited");

    const replay = await request(app.getHttpServer()).post("/v1/snaps").set(auth()).send(payload);
    expect(replay.body.status).toBe("already_synced");

    const { rows } = await pool.query(
      `SELECT id FROM snaps WHERE alias_id = $1 AND client_msg_id = $2`,
      [member.aliasId, clientMsgId]
    );
    expect(rows).toHaveLength(1);
  });

  it("SPEC.md §32: recognition tags the photo in the background without delaying the reward", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/snaps")
      .set(auth())
      .send({
        clientMsgId: randomUUID(),
        imageBase64: Buffer.from("fake-jpeg-bytes-3").toString("base64"),
        capturedAt: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("credited"); // the response itself never waits on recognition

    let row: { state: string; recognized_tags: string[] | null; recognized_category_id: number | null } | undefined;
    for (let i = 0; i < 20; i++) {
      const { rows } = await pool.query(
        `SELECT state, recognized_tags, recognized_category_id FROM snaps WHERE id = $1`,
        [res.body.snapId]
      );
      row = rows[0];
      if (row?.state === "recognized") break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(row?.state).toBe("recognized");
    expect(row?.recognized_tags).toEqual(["rice", "5kg bag", "branded package"]);

    const { rows: catRows } = await pool.query(`SELECT slug FROM categories WHERE id = $1`, [
      row?.recognized_category_id,
    ]);
    expect(catRows[0].slug).toBe("rice");
  });
});
