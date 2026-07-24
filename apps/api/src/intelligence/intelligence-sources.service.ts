import { createHash } from "crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";
import { DriveFile, DriveProvider, GoogleDriveProvider } from "./drive.provider";

// Whoever fills in the "folder ID" field is going to paste whatever's in
// their browser's address bar most of the time, not go hunt for the bare
// ID — accept the full share URL (any of Drive's several URL shapes) and
// extract the ID, rather than silently storing an unusable value that only
// fails later, deep inside a Drive API call.
export function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];
  return trimmed;
}

export interface SyncResult {
  documentsListed: number;
  synced: number;
  unchanged: number;
  skipped: number;
  skippedFiles: string[];
}

// Ingests documents from a connected Drive folder into intelligence_documents.
// A source is scoped to one zone (SPEC.md §20) — "the place" the eventual
// understanding is built for.
@Injectable()
export class IntelligenceSourcesService {
  private driveInstance: DriveProvider | null = null;
  // Test-only seam — see ZoneUnderstandingService.llmOverride for the same pattern.
  driveOverride: DriveProvider | null = null;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // Config errors (missing GOOGLE_SERVICE_ACCOUNT_KEY) are re-thrown as
  // BadRequestException — NestJS's default filter masks a plain Error as an
  // opaque 500, and the whole point of failing loudly here is that ops sees
  // the real reason in the portal, not a generic "Internal server error."
  private get drive(): DriveProvider {
    if (this.driveOverride) return this.driveOverride;
    if (!this.driveInstance) {
      try {
        this.driveInstance = new GoogleDriveProvider();
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
    }
    return this.driveInstance;
  }

  async connectSource(zoneId: string, externalRef: string, displayName: string) {
    const { rows } = await this.pool.query<{ id: number }>(
      `INSERT INTO intelligence_sources (zone_id, kind, external_ref, display_name)
       VALUES ($1, 'google_drive_folder', $2, $3) RETURNING id`,
      [zoneId, extractDriveFolderId(externalRef), displayName]
    );
    return { id: rows[0].id };
  }

  async listSources(zoneId?: string) {
    const { rows } = await this.pool.query(
      zoneId
        ? `SELECT id, zone_id, kind, external_ref, display_name, created_at, last_synced_at
           FROM intelligence_sources WHERE zone_id = $1 ORDER BY id`
        : `SELECT id, zone_id, kind, external_ref, display_name, created_at, last_synced_at
           FROM intelligence_sources ORDER BY id`,
      zoneId ? [zoneId] : []
    );
    return rows;
  }

  /**
   * Lists every file in the connected folder and ingests each one's plain
   * text. A file whose content hash hasn't changed since last sync is
   * skipped (no wasted re-processing); a file this provider can't extract
   * text from (PDFs, Slides, etc. — §20C) is skipped too, but named in the
   * response rather than silently dropped (no silent caps).
   */
  async sync(sourceId: number): Promise<SyncResult> {
    const { rows: sourceRows } = await this.pool.query<{ external_ref: string }>(
      `SELECT external_ref FROM intelligence_sources WHERE id = $1`,
      [sourceId]
    );
    if (!sourceRows[0]) throw new NotFoundException(`Source ${sourceId} not found`);

    let files: DriveFile[];
    try {
      files = await this.drive.listFiles(sourceRows[0].external_ref);
    } catch (err) {
      // Same reasoning as the `drive` getter above — a folder-not-accessible
      // error needs to reach the portal as a readable message, not NestJS's
      // generic 500 for an unrecognized Error.
      throw new BadRequestException((err as Error).message);
    }
    let synced = 0;
    let unchanged = 0;
    let skipped = 0;
    const skippedFiles: string[] = [];

    const nulByte = String.fromCharCode(0);
    for (const file of files) {
      let text: string;
      try {
        text = await this.drive.getFileText(file);
      } catch {
        skipped += 1;
        skippedFiles.push(`${file.name} (${file.mimeType})`);
        continue;
      }
      // PDF/pptx extraction can surface embedded NUL control characters
      // (font/glyph artifacts) that Postgres' UTF8 text columns reject
      // outright — strip them here, once, for every extractor rather than
      // per file-type branch in the Drive provider.
      text = text.split(nulByte).join("");

      const hash = createHash("sha256").update(text).digest("hex");
      const { rows: existing } = await this.pool.query<{ id: number; content_hash: string | null }>(
        `SELECT id, content_hash FROM intelligence_documents WHERE source_id = $1 AND external_id = $2`,
        [sourceId, file.id]
      );

      if (existing[0]?.content_hash === hash) {
        unchanged += 1;
        continue;
      }

      if (existing[0]) {
        await this.pool.query(
          `UPDATE intelligence_documents
           SET title = $1, mime_type = $2, content_text = $3, content_hash = $4, fetched_at = now()
           WHERE id = $5`,
          [file.name, file.mimeType, text, hash, existing[0].id]
        );
      } else {
        await this.pool.query(
          `INSERT INTO intelligence_documents (source_id, external_id, title, mime_type, content_text, content_hash)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [sourceId, file.id, file.name, file.mimeType, text, hash]
        );
      }
      synced += 1;
    }

    await this.pool.query(`UPDATE intelligence_sources SET last_synced_at = now() WHERE id = $1`, [
      sourceId,
    ]);

    return { documentsListed: files.length, synced, unchanged, skipped, skippedFiles };
  }

  async listDocuments(sourceId: number) {
    const { rows } = await this.pool.query(
      `SELECT id, external_id, title, mime_type, fetched_at,
              (content_text IS NOT NULL) AS has_text
       FROM intelligence_documents WHERE source_id = $1 ORDER BY fetched_at DESC`,
      [sourceId]
    );
    return rows;
  }
}
