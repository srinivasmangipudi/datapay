import { createHash } from "crypto";

export interface StorageProvider {
  store(imageBase64: string): Promise<{ storageKey: string }>;
}

/**
 * DEV ONLY — no real blob storage (S3/GCS) is wired up yet. Computes a content
 * hash as a stand-in storage_key and discards the actual image bytes entirely.
 * "Photo evidence" is not a real claim until this is swapped for a real provider.
 */
export class DevNoopStorageProvider implements StorageProvider {
  async store(imageBase64: string): Promise<{ storageKey: string }> {
    const hash = createHash("sha256").update(imageBase64).digest("hex").slice(0, 32);
    return { storageKey: `dev-stub://${hash}` };
  }
}
