import { BadRequestException, Controller, Get, Header, NotFoundException, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { S3StorageProvider } from "../snaps/storage.provider";

// Railway Buckets are private (no public-URL mode) — this proxies the actual
// GetObject call so a stored photo can still be reached by a plain URL, the
// same one `org_products.photo_url` stores. Public, unauthenticated: photos
// are already shown to any member browsing the catalog, so gating this
// endpoint separately would add nothing.
@Controller("v1/photos")
export class PhotosController {
  private storageInstance: S3StorageProvider | null = null;
  storageOverride: S3StorageProvider | null = null;

  private get storage(): S3StorageProvider {
    if (this.storageOverride) return this.storageOverride;
    if (!this.storageInstance) {
      try {
        this.storageInstance = new S3StorageProvider();
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
    }
    return this.storageInstance;
  }

  // A fixed two-segment shape (products/<sha256 filename>) rather than a
  // wildcard route — every key S3StorageProvider.store() ever produces looks
  // exactly like this, so there's no need for open-ended path matching.
  @Get("products/:filename")
  @Header("Cache-Control", "public, max-age=31536000, immutable")
  async get(@Param("filename") filename: string, @Res() res: Response) {
    // Content-hashed keys never change once written — safe to cache forever,
    // same reasoning as a fingerprinted static asset.
    let object: { body: Buffer; contentType: string };
    try {
      object = await this.storage.get(`products/${filename}`);
    } catch {
      throw new NotFoundException("Photo not found");
    }
    res.setHeader("Content-Type", object.contentType);
    res.send(object.body);
  }
}
