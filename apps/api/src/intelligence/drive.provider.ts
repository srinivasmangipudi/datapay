import { google } from "googleapis";
import { PDFParse } from "pdf-parse";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface DriveProvider {
  listFiles(folderId: string): Promise<DriveFile[]>;
  // Throws for a mime type this provider can't extract plain text from
  // (SPEC.md §20C) — the caller decides whether to skip-and-log or fail.
  getFileText(file: DriveFile): Promise<string>;
}

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

// Recursively collects every DrawingML text-run value ("a:t") out of a
// parsed slide XML tree — walking the tree (rather than a flat regex over
// the raw XML) copes with however deeply text runs end up nested inside
// shapes/groups/tables without assuming one fixed structure.
function collectSlideText(node: unknown, out: string[]): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectSlideText(item, out);
    return;
  }
  if (typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (typeof record["a:t"] === "string") {
      out.push(record["a:t"]);
    } else if ("a:t" in record) {
      collectSlideText(record["a:t"], out);
    }
    for (const key of Object.keys(record)) {
      if (key === "a:t") continue;
      collectSlideText(record[key], out);
    }
  }
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)/)![1]) - Number(b.match(/(\d+)/)![1]));

  const parser = new XMLParser({ ignoreAttributes: true });
  const slideTexts: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("text");
    const texts: string[] = [];
    collectSlideText(parser.parse(xml), texts);
    slideTexts.push(texts.join(" "));
  }
  return slideTexts.join("\n\n");
}

// The real thing — the user explicitly chose a service account over OAuth.
// Auth: share the target Drive folder with the service account's own email
// (from the key JSON's client_email) — read-only scope, no write access ever
// requested.
export class GoogleDriveProvider implements DriveProvider {
  private readonly drive;
  private readonly serviceAccountEmail: string;

  constructor() {
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyJson) {
      throw new Error(
        "Missing GOOGLE_SERVICE_ACCOUNT_KEY — required for Drive-backed intelligence sources (SPEC.md §20)"
      );
    }
    let credentials: { client_email?: string; private_key?: string };
    try {
      credentials = JSON.parse(keyJson);
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON");
    }
    this.serviceAccountEmail = credentials.client_email ?? "(unknown — no client_email in key)";
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    this.drive = google.drive({ version: "v3", auth: auth as any });
  }

  async listFiles(folderId: string): Promise<DriveFile[]> {
    // `files.list`'s `q` filter degrades silently to an empty result set for
    // a folder ID the caller can't see — indistinguishable from "the folder
    // is genuinely empty" unless checked separately. Fetching the folder
    // itself surfaces the real 404/403 instead of masking a sharing problem
    // as "0 documents found."
    try {
      await this.drive.files.get({ fileId: folderId, fields: "id" });
    } catch {
      throw new Error(
        `Folder ${folderId} isn't accessible to this service account. Share it (Viewer) with ` +
          `${this.serviceAccountEmail} in Google Drive, then sync again.`
      );
    }

    const res = await this.drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType)",
      pageSize: 200,
    });
    return (res.data.files ?? []).map((f) => ({
      id: f.id!,
      name: f.name ?? "(untitled)",
      mimeType: f.mimeType ?? "application/octet-stream",
    }));
  }

  async getFileText(file: DriveFile): Promise<string> {
    if (file.mimeType === GOOGLE_DOC_MIME) {
      const res = await this.drive.files.export(
        { fileId: file.id, mimeType: "text/plain" },
        { responseType: "text" }
      );
      return res.data as unknown as string;
    }
    if (file.mimeType.startsWith("text/") || file.mimeType === "application/json") {
      const res = await this.drive.files.get(
        { fileId: file.id, alt: "media" },
        { responseType: "text" }
      );
      return res.data as unknown as string;
    }
    if (file.mimeType === "application/pdf") {
      const res = await this.drive.files.get(
        { fileId: file.id, alt: "media" },
        { responseType: "arraybuffer" }
      );
      const parser = new PDFParse({ data: Buffer.from(res.data as ArrayBuffer) });
      try {
        const { text } = await parser.getText();
        // PDF text extraction can surface embedded NUL control characters
        // (font/glyph artifacts) that Postgres' UTF8 text columns reject
        // outright — strip them rather than let the whole sync 500.
        return text.replace(/\u0000/g, "");
      } finally {
        await parser.destroy();
      }
    }
    if (file.mimeType === GOOGLE_SLIDES_MIME) {
      const res = await this.drive.files.export(
        { fileId: file.id, mimeType: "text/plain" },
        { responseType: "text" }
      );
      return res.data as unknown as string;
    }
    if (file.mimeType === PPTX_MIME) {
      const res = await this.drive.files.get(
        { fileId: file.id, alt: "media" },
        { responseType: "arraybuffer" }
      );
      return extractPptxText(Buffer.from(res.data as ArrayBuffer));
    }
    // Google Sheets, images, etc. — not implemented in this pass. Thrown,
    // not silently skipped-without-a-trace; the sync service catches this
    // per-file and records it, per §11's "flag, don't fake" rule.
    throw new Error(`Unsupported mime type for text extraction: ${file.mimeType}`);
  }
}
