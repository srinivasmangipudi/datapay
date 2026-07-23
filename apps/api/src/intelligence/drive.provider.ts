import { google } from "googleapis";

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

// The real thing — the user explicitly chose a service account over OAuth.
// Auth: share the target Drive folder with the service account's own email
// (from the key JSON's client_email) — read-only scope, no write access ever
// requested.
export class GoogleDriveProvider implements DriveProvider {
  private readonly drive;

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
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    this.drive = google.drive({ version: "v3", auth: auth as any });
  }

  async listFiles(folderId: string): Promise<DriveFile[]> {
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
    // PDFs, Google Sheets/Slides, images, etc. — not implemented in this
    // pass. Thrown, not silently skipped-without-a-trace; the sync service
    // catches this per-file and records it, per §11's "flag, don't fake" rule.
    throw new Error(`Unsupported mime type for text extraction: ${file.mimeType}`);
  }
}
