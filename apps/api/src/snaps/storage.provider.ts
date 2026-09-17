import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

/**
 * Real storage, backed by a Railway S3-compatible bucket — built for the org
 * product catalog feature, which needs photos that actually display, unlike
 * pulse/snap answers where the photo itself was never the point (Vision
 * analysis was).
 *
 * Railway Buckets are private — there is no public-URL mode (confirmed via
 * Railway's own docs: "Public buckets are currently not supported"). So
 * `storageKey` here is a URL on OUR OWN api service
 * (PhotosController, ../photos/photos.controller.ts), which proxies the
 * actual GetObject call — never a raw bucket URL. The mobile client still
 * just uses it directly as an <Image> source; the proxy is invisible to it.
 */
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    const endpoint = process.env.PRODUCT_PHOTOS_S3_ENDPOINT;
    const accessKeyId = process.env.PRODUCT_PHOTOS_S3_ACCESS_KEY;
    const secretAccessKey = process.env.PRODUCT_PHOTOS_S3_SECRET_KEY;
    const bucket = process.env.PRODUCT_PHOTOS_S3_BUCKET;
    // Our OWN api service's public base URL + /v1/photos — not the bucket's.
    const publicBaseUrl = process.env.PRODUCT_PHOTOS_PUBLIC_BASE_URL;
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
      throw new Error(
        "Missing PRODUCT_PHOTOS_S3_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET/PUBLIC_BASE_URL — required for product photo storage"
      );
    }
    this.bucket = bucket;
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, "");
    this.client = new S3Client({
      endpoint,
      region: process.env.PRODUCT_PHOTOS_S3_REGION || "auto",
      credentials: { accessKeyId, secretAccessKey },
      // Railway Buckets use virtual-hosted–style URLs (bucket name as
      // subdomain) — the SDK default, not path-style.
      forcePathStyle: false,
    });
  }

  async store(imageBase64: string): Promise<{ storageKey: string }> {
    // Expo's ImagePicker (base64: true) returns a raw base64 string, but
    // strip a data: URI prefix defensively in case a caller sends one.
    const raw = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(raw, "base64");
    const hash = createHash("sha256").update(buffer).digest("hex");
    const key = `products/${hash}.jpg`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: "image/jpeg",
      })
    );

    return { storageKey: `${this.publicBaseUrl}/${key}` };
  }

  // Used only by PhotosController's proxy route — fetches the raw bytes back
  // out of the bucket to stream to a client, since the bucket itself can
  // never be reached directly.
  async get(key: string): Promise<{ body: Buffer; contentType: string }> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const body = Buffer.from(await res.Body!.transformToByteArray());
    return { body, contentType: res.ContentType ?? "image/jpeg" };
  }
}
