import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../app.module";
import { TranslationProvider, TranslationService } from "./translation.service";

class FakeTranslationProvider implements TranslationProvider {
  async translate(text: string): Promise<string> {
    return `[kn] ${text}`;
  }
}

describe("Translation — an editable starting draft, never the system of record (SPEC.md §27)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    app.get(TranslationService).translationOverride = new FakeTranslationProvider();
  });

  afterAll(async () => {
    await app.close();
  });

  it("translates English text to Kannada", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/admin/translate")
      .send({ text: "Which soap brand does your household use?", targetLang: "kn" });

    expect(res.status).toBe(201);
    expect(res.body.translated).toBe("[kn] Which soap brand does your household use?");
  });

  it("rejects an unsupported target language clearly", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/admin/translate")
      .send({ text: "hello", targetLang: "fr" });

    expect(res.status).toBe(400);
  });
});
