import { computeAliasId, generateDisplayAliasCandidate } from "./alias.util";

describe("computeAliasId", () => {
  it("is deterministic for the same user_id and pepper", () => {
    const a = computeAliasId("user-123", "pepper-a");
    const b = computeAliasId("user-123", "pepper-a");
    expect(a).toBe(b);
  });

  it("produces a 64-char hex string (SHA-256 digest)", () => {
    const alias = computeAliasId("user-123", "pepper-a");
    expect(alias).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes if the pepper changes — non-reversible without it", () => {
    const a = computeAliasId("user-123", "pepper-a");
    const b = computeAliasId("user-123", "pepper-b");
    expect(a).not.toBe(b);
  });

  it("changes if the user_id changes", () => {
    const a = computeAliasId("user-123", "pepper-a");
    const b = computeAliasId("user-456", "pepper-a");
    expect(a).not.toBe(b);
  });

  it("throws without a pepper", () => {
    expect(() => computeAliasId("user-123", "")).toThrow();
  });
});

describe("generateDisplayAliasCandidate", () => {
  it("matches the RIVER BIRD NN shape", () => {
    const alias = generateDisplayAliasCandidate();
    expect(alias).toMatch(/^[A-Z-]+ [A-Z-]+ \d{1,2}$/);
  });
});
