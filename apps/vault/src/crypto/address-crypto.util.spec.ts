import { decryptAddress, encryptAddress } from "./address-crypto.util";

describe("address-crypto", () => {
  const original = process.env.ADDRESS_ENCRYPTION_KEY;
  beforeAll(() => {
    process.env.ADDRESS_ENCRYPTION_KEY = "test-passphrase-do-not-use-in-prod";
  });
  afterAll(() => {
    process.env.ADDRESS_ENCRYPTION_KEY = original;
  });

  it("round-trips plaintext through encrypt/decrypt", () => {
    const plaintext = "House 12, Kikkeri Village, Mandya 571401";
    const encrypted = encryptAddress(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptAddress(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const a = encryptAddress("same address");
    const b = encryptAddress("same address");
    expect(a).not.toBe(b);
  });

  it("rejects a tampered ciphertext (GCM auth tag)", () => {
    const encrypted = encryptAddress("some address");
    const [iv, tag, data] = encrypted.split(".");
    const tampered = [iv, tag, data.slice(0, -4) + "abcd"].join(".");
    expect(() => decryptAddress(tampered)).toThrow();
  });
});
