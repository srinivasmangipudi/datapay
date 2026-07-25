import {
  computeAliasId,
  generateDisplayAliasCandidate,
  generateDisplayAliasCandidates,
  isWellFormedDisplayAlias,
} from "./alias.util";

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

describe("generateDisplayAliasCandidates (SPEC.md §36)", () => {
  it("returns the requested count with no duplicates", () => {
    const batch = generateDisplayAliasCandidates(8);
    expect(batch).toHaveLength(8);
    expect(new Set(batch).size).toBe(8);
  });

  it("every candidate is well-formed", () => {
    for (const candidate of generateDisplayAliasCandidates(8)) {
      expect(isWellFormedDisplayAlias(candidate)).toBe(true);
    }
  });
});

describe("isWellFormedDisplayAlias", () => {
  it("accepts a real generated candidate", () => {
    expect(isWellFormedDisplayAlias(generateDisplayAliasCandidate())).toBe(true);
  });

  it("rejects a member-typed name not from the word lists", () => {
    expect(isWellFormedDisplayAlias("MY OWN NAME 7")).toBe(false);
  });

  it("rejects a well-formed-looking string using words outside the lists", () => {
    expect(isWellFormedDisplayAlias("GANGES SPARROW 5")).toBe(false);
  });

  it("rejects a number outside 1-99", () => {
    expect(isWellFormedDisplayAlias("KAVERI HERON 100")).toBe(false);
  });

  it("rejects garbage input", () => {
    expect(isWellFormedDisplayAlias("")).toBe(false);
    expect(isWellFormedDisplayAlias("KAVERI HERON")).toBe(false);
    expect(isWellFormedDisplayAlias("kaveri heron 5")).toBe(false); // case-sensitive
  });
});
