import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../app.module";
import { PG_POOL } from "../db/db.module";
import { QuestionFeederService } from "../question-feeder/question-feeder.service";
import { DocumentGroundedGeneratorService } from "./document-grounded-generator.service";
import { DriveFile, DriveProvider } from "./drive.provider";
import { IntelligenceSourcesService } from "./intelligence-sources.service";
import { LlmProvider } from "./llm.provider";
import { ZoneUnderstandingService } from "./zone-understanding.service";

const MELUKOTE_ZONE_ID = "00000000-0000-0000-0000-000000000001";

class FakeDriveProvider implements DriveProvider {
  constructor(private readonly files: (DriveFile & { text?: string })[]) {}

  async listFiles(): Promise<DriveFile[]> {
    return this.files.map(({ id, name, mimeType }) => ({ id, name, mimeType }));
  }

  async getFileText(file: DriveFile): Promise<string> {
    const match = this.files.find((f) => f.id === file.id);
    if (!match?.text) throw new Error(`Unsupported mime type for text extraction: ${file.mimeType}`);
    return match.text;
  }
}

class FakeLlmProvider implements LlmProvider {
  constructor(private readonly response: string) {}
  async complete(): Promise<string> {
    return this.response;
  }
}

const VALID_UNDERSTANDING_RESPONSE = JSON.stringify({
  summaryEn: "Kikkeri households rely heavily on sugarcane farming and dairy cooperatives.",
  summaryKn: "ಕಿಕ್ಕೇರಿ ಮನೆಗಳು ಕಬ್ಬು ಕೃಷಿ ಮತ್ತು ಡೈರಿ ಸಹಕಾರಿ ಸಂಘಗಳ ಮೇಲೆ ಹೆಚ್ಚು ಅವಲಂಬಿತವಾಗಿವೆ.",
  knowledgeMap: {
    economicActivities: ["sugarcane farming", "dairy cooperative"],
    commonProductsAndBrands: ["local jaggery"],
    seasonalPatterns: ["harvest season Oct-Dec increases cash liquidity"],
    notableConcerns: ["fluctuating mill prices"],
    demandSignals: ["interest in bulk fertilizer purchase"],
  },
});

const VALID_QUESTION_VARIANTS_RESPONSE = JSON.stringify([
  {
    textEn: "Do you sell your sugarcane to the local jaggery unit?",
    textKn: "ನೀವು ನಿಮ್ಮ ಕಬ್ಬನ್ನು ಸ್ಥಳೀಯ ಬೆಲ್ಲದ ಘಟಕಕ್ಕೆ ಮಾರಾಟ ಮಾಡುತ್ತೀರಾ?",
    type: "yesno",
    rewardTokens: 4,
    options: [
      { labelEn: "Yes", labelKn: "ಹೌದು" },
      { labelEn: "No", labelKn: "ಇಲ್ಲ" },
    ],
  },
]);

describe("Area intelligence — documents → understanding → grounded questions (SPEC.md §20)", () => {
  let app: INestApplication;
  let pool: Pool;
  let sourcesService: IntelligenceSourcesService;
  let understandingService: ZoneUnderstandingService;
  let generatorService: DocumentGroundedGeneratorService;
  let questionFeeder: QuestionFeederService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = app.get(PG_POOL);
    sourcesService = app.get(IntelligenceSourcesService);
    understandingService = app.get(ZoneUnderstandingService);
    generatorService = app.get(DocumentGroundedGeneratorService);
    questionFeeder = app.get(QuestionFeederService);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  async function cleanupZoneIntelligence() {
    await pool.query(
      `DELETE FROM intelligence_documents WHERE source_id IN
         (SELECT id FROM intelligence_sources WHERE zone_id = $1)`,
      [MELUKOTE_ZONE_ID]
    );
    await pool.query(`DELETE FROM intelligence_sources WHERE zone_id = $1`, [MELUKOTE_ZONE_ID]);
    await pool.query(`DELETE FROM zone_understanding WHERE zone_id = $1`, [MELUKOTE_ZONE_ID]);
  }

  afterEach(async () => {
    await cleanupZoneIntelligence();
  });

  it("§20C: sync ingests supported files, skips-and-names unsupported ones, and is idempotent on unchanged content", async () => {
    const { id: sourceId } = await sourcesService.connectSource(
      MELUKOTE_ZONE_ID,
      "fake-folder-1",
      "Test source"
    );
    sourcesService.driveOverride = new FakeDriveProvider([
      { id: "doc-1", name: "Panchayat notes.txt", mimeType: "text/plain", text: "Sugarcane yields rose this year." },
      { id: "doc-2", name: "Survey.pdf", mimeType: "application/pdf" }, // no text() — unsupported
    ]);

    const firstSync = await sourcesService.sync(sourceId);
    expect(firstSync.documentsListed).toBe(2);
    expect(firstSync.synced).toBe(1);
    expect(firstSync.skipped).toBe(1);
    expect(firstSync.skippedFiles).toEqual(["Survey.pdf (application/pdf)"]);

    const { rows } = await pool.query(
      `SELECT title, content_text FROM intelligence_documents WHERE source_id = $1`,
      [sourceId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Panchayat notes.txt");
    expect(rows[0].content_text).toContain("Sugarcane yields rose");

    const resync = await sourcesService.sync(sourceId);
    expect(resync.synced).toBe(0);
    expect(resync.unchanged).toBe(1);

    sourcesService.driveOverride = null;
  });

  it("§20B: refresh builds a real understanding from ingested documents, and a second refresh adds a new row rather than overwriting", async () => {
    const { id: sourceId } = await sourcesService.connectSource(
      MELUKOTE_ZONE_ID,
      "fake-folder-2",
      "Test source"
    );
    sourcesService.driveOverride = new FakeDriveProvider([
      { id: "doc-1", name: "Notes.txt", mimeType: "text/plain", text: "Sugarcane and dairy dominate the local economy." },
    ]);
    await sourcesService.sync(sourceId);
    sourcesService.driveOverride = null;

    understandingService.llmOverride = new FakeLlmProvider(VALID_UNDERSTANDING_RESPONSE);
    const first = await understandingService.refresh(MELUKOTE_ZONE_ID);
    expect(first.summaryEn).toContain("sugarcane farming");
    expect(first.knowledgeMap.economicActivities).toContain("dairy cooperative");
    expect(first.modelUsed).toBeTruthy();

    const second = await understandingService.refresh(MELUKOTE_ZONE_ID);
    expect(second.id).not.toBe(first.id);
    understandingService.llmOverride = null;

    const { rows } = await pool.query(
      `SELECT count(*) FROM zone_understanding WHERE zone_id = $1`,
      [MELUKOTE_ZONE_ID]
    );
    expect(Number(rows[0].count)).toBe(2); // both kept — history, not overwritten

    const latest = await understandingService.getLatest(MELUKOTE_ZONE_ID);
    expect(latest?.id).toBe(second.id);
  });

  it("refresh fails clearly with no ingested documents, rather than calling the LLM with nothing", async () => {
    await expect(understandingService.refresh(MELUKOTE_ZONE_ID)).rejects.toThrow(
      /No ingested documents/
    );
  });

  it("§20D: a document_grounded topic drafts questions from the zone's understanding, landing in the same review queue as a template topic", async () => {
    const { rows: catRows } = await pool.query<{ id: number }>(
      `SELECT id FROM categories WHERE slug = 'sugar'`
    );
    const categoryId = catRows[0].id;

    const { id: sourceId } = await sourcesService.connectSource(
      MELUKOTE_ZONE_ID,
      "fake-folder-3",
      "Test source"
    );
    sourcesService.driveOverride = new FakeDriveProvider([
      { id: "doc-1", name: "Notes.txt", mimeType: "text/plain", text: "Sugarcane dominates." },
    ]);
    await sourcesService.sync(sourceId);
    sourcesService.driveOverride = null;

    understandingService.llmOverride = new FakeLlmProvider(VALID_UNDERSTANDING_RESPONSE);
    await understandingService.refresh(MELUKOTE_ZONE_ID);
    understandingService.llmOverride = null;

    const { id: topicId } = await questionFeeder.createTopic({
      slug: `oil-doc-grounded-${Date.now()}`,
      name: "Document-grounded test topic",
      categoryId,
      generatorKind: "document_grounded",
      config: { questionCount: 1 },
      zoneId: MELUKOTE_ZONE_ID,
    });

    generatorService.llmOverride = new FakeLlmProvider(VALID_QUESTION_VARIANTS_RESPONSE);
    const result = await questionFeeder.generate(topicId);
    generatorService.llmOverride = null;

    expect(result.status).toBe("completed");
    expect(result.questionsGenerated).toBe(1);

    const { rows: qRows } = await pool.query(
      `SELECT text_en, source, review_state FROM questions WHERE generation_run_id = $1`,
      [result.runId]
    );
    expect(qRows).toHaveLength(1);
    expect(qRows[0].source).toBe("plugin_generated");
    expect(qRows[0].review_state).toBe("draft"); // never auto-approved — same gate as every other draft

    await pool.query(`DELETE FROM question_options WHERE question_id IN
      (SELECT id FROM questions WHERE generation_run_id = $1)`, [result.runId]);
    await pool.query(`DELETE FROM questions WHERE generation_run_id = $1`, [result.runId]);
    await pool.query(`DELETE FROM question_generation_runs WHERE id = $1`, [result.runId]);
    await pool.query(`DELETE FROM question_topics WHERE id = $1`, [topicId]);
  });

  it("§20D: malformed LLM output fails the run cleanly — no partial drafts", async () => {
    const { rows: catRows } = await pool.query<{ id: number }>(
      `SELECT id FROM categories WHERE slug = 'sugar'`
    );
    const categoryId = catRows[0].id;

    const { id: sourceId } = await sourcesService.connectSource(
      MELUKOTE_ZONE_ID,
      "fake-folder-4",
      "Test source"
    );
    sourcesService.driveOverride = new FakeDriveProvider([
      { id: "doc-1", name: "Notes.txt", mimeType: "text/plain", text: "Sugarcane dominates." },
    ]);
    await sourcesService.sync(sourceId);
    sourcesService.driveOverride = null;

    understandingService.llmOverride = new FakeLlmProvider(VALID_UNDERSTANDING_RESPONSE);
    await understandingService.refresh(MELUKOTE_ZONE_ID);
    understandingService.llmOverride = null;

    const { id: topicId } = await questionFeeder.createTopic({
      slug: `oil-malformed-${Date.now()}`,
      name: "Malformed output test topic",
      categoryId,
      generatorKind: "document_grounded",
      config: { questionCount: 1 },
      zoneId: MELUKOTE_ZONE_ID,
    });

    generatorService.llmOverride = new FakeLlmProvider("not valid json at all");
    await expect(questionFeeder.generate(topicId)).rejects.toThrow();
    generatorService.llmOverride = null;

    const { rows: runRows } = await pool.query(
      `SELECT status FROM question_generation_runs WHERE topic_id = $1`,
      [topicId]
    );
    expect(runRows[0].status).toBe("failed");

    const { rows: qRows } = await pool.query(
      `SELECT id FROM questions WHERE generator_topic_id = $1`,
      [topicId]
    );
    expect(qRows).toHaveLength(0); // nothing partial persisted

    await pool.query(`DELETE FROM question_generation_runs WHERE topic_id = $1`, [topicId]);
    await pool.query(`DELETE FROM question_topics WHERE id = $1`, [topicId]);
  });

  it("§20D: a document_grounded topic with no zone_id fails clearly instead of silently picking one", async () => {
    const { rows: catRows } = await pool.query<{ id: number }>(
      `SELECT id FROM categories WHERE slug = 'sugar'`
    );
    const { id: topicId } = await questionFeeder.createTopic({
      slug: `oil-no-zone-${Date.now()}`,
      name: "No zone test topic",
      categoryId: catRows[0].id,
      generatorKind: "document_grounded",
      config: { questionCount: 1 },
    });

    await expect(questionFeeder.generate(topicId)).rejects.toThrow(/require a zone_id/);

    await pool.query(`DELETE FROM question_generation_runs WHERE topic_id = $1`, [topicId]);
    await pool.query(`DELETE FROM question_topics WHERE id = $1`, [topicId]);
  });

  it("intelligence-sources endpoints respond over HTTP end to end", async () => {
    const connectRes = await request(app.getHttpServer())
      .post("/v1/admin/intelligence-sources")
      .send({ zoneId: MELUKOTE_ZONE_ID, externalRef: "http-folder", displayName: "HTTP test source" });
    expect(connectRes.status).toBe(201);

    const listRes = await request(app.getHttpServer()).get(
      `/v1/admin/intelligence-sources?zoneId=${MELUKOTE_ZONE_ID}`
    );
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((s: { id: number }) => s.id === connectRes.body.id)).toBe(true);

    const understandingRes = await request(app.getHttpServer()).get(
      `/v1/admin/zones/${MELUKOTE_ZONE_ID}/understanding`
    );
    expect(understandingRes.status).toBe(200);
    expect(understandingRes.body.message).toMatch(/No understanding/);
  });
});
