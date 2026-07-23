import { decryptSecret, encryptSecret } from "./secret-crypto.util";

describe("secret-crypto", () => {
  const original = process.env.VAULT_SECRET_KEY;
  beforeAll(() => {
    process.env.VAULT_SECRET_KEY = "test-passphrase-do-not-use-in-prod";
  });
  afterAll(() => {
    process.env.VAULT_SECRET_KEY = original;
  });

  it("round-trips an address through encrypt/decrypt", () => {
    const plaintext = "House 12, Kikkeri Village, Mandya 571401";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("round-trips a UPI ID through encrypt/decrypt", () => {
    const plaintext = "ravi.farmer@okaxis";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same secret");
    const b = encryptSecret("same secret");
    expect(a).not.toBe(b);
  });

  it("rejects a tampered ciphertext (GCM auth tag)", () => {
    const encrypted = encryptSecret("some secret");
    const [iv, tag, data] = encrypted.split(".");
    const tampered = [iv, tag, data.slice(0, -4) + "abcd"].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
