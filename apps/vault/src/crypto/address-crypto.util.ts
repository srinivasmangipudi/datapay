import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * AES-256-GCM, reversible by design — unlike the alias (one-way HMAC), a
 * delivery address must be decryptable, because Vault hands it to a PACS
 * node at dispatch (§7). The key never leaves Vault's process/KMS.
 * Dev placeholder: ADDRESS_ENCRYPTION_KEY is a passphrase run through scrypt;
 * production should source a real 32-byte key from a real KMS.
 */
function deriveKey(): Buffer {
  const passphrase = process.env.ADDRESS_ENCRYPTION_KEY;
  if (!passphrase) throw new Error("Missing ADDRESS_ENCRYPTION_KEY");
  return scryptSync(passphrase, "datapay-address-salt", 32);
}

export function encryptAddress(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((b) => b.toString("base64")).join(".");
}

export function decryptAddress(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(".");
  const key = deriveKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
