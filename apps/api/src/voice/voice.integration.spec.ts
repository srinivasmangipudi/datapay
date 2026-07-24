import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { createTestMember, deleteTestMember, TestMember } from "../test-fixtures";
import { AsrProvider } from "./asr.provider";
import { VoiceService } from "./voice.service";

const CORE_MIGRATIONS_DIR = join(__dirname, "../../../../infra/migrations/core");
const AUDIO_COLUMN_DECLARATION = /["']?\baudio[a-z0-9_]*["']?\s*:/i;

class FakeAsrProvider implements AsrProvider {
  async transcribe(): Promise<{ text: string; translatedText?: string }> {
    return { text: "ಪುಟ್ಟ ಅಂಗಡಿಯಿಂದ", translatedText: "from the small shop" };
  }
}

describe("Voice — audio is transcribed and discarded, never persisted (SPEC.md §8/§9)", () => {
  let app: INestApplication;
  let pool: Pool;
  let member: TestMember;
  const fakeAudioBase64 = Buffer.from("not-real-audio-bytes-just-a-test-payload").toString(
    "base64"
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    const jwt = app.get(JwtService);
    member = await createTestMember(pool, jwt);
    app.get(VoiceService).asrOverride = new FakeAsrProvider();
  });

  afterAll(async () => {
    await deleteTestMember(pool, member.aliasId);
    await app.close();
    await pool.end();
  });

  it("no core_db migration declares any column for storing audio bytes", () => {
    const files = readdirSync(CORE_MIGRATIONS_DIR).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      const text = readFileSync(join(CORE_MIGRATIONS_DIR, file), "utf8");
      expect(text).not.toMatch(AUDIO_COLUMN_DECLARATION);
    }
  });

  it("the transcribe response never echoes the submitted audio back", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/voice/transcribe")
      .set({ Authorization: `Bearer ${member.token}` })
      .send({ audioBase64: fakeAudioBase64, language: "kn" });

    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain(fakeAudioBase64);
  });
});
