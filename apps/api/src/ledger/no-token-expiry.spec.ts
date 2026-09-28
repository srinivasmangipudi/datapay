import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Tokens never expire — a product commitment (see the comment on
 * TokenLedgerEntry). An expiry job would quietly shrink someone's accumulated
 * balance, and the reward share is computed over that balance, so expiring
 * tokens would reduce a distribution a member was told was theirs to keep.
 *
 * A comment alone doesn't survive a refactor a year from now. This walks the
 * API source for any code that actually writes an 'expire' entry and fails if
 * one appears, naming the file.
 */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "node_modules" && name !== "dist") sourceFiles(full, out);
    } else if (name.endsWith(".ts") && !name.endsWith(".spec.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("Tokens never expire", () => {
  it("no application code writes an 'expire' ledger entry", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(join(__dirname, ".."))) {
      const src = readFileSync(file, "utf8");
      // The union member declaration in ledger.service.ts is the one legitimate
      // mention; everything else would be code that USES it.
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        // Comments discuss the rule (including the one above) without
        // implementing it, and the union member declares the type without
        // using it. Only real code counts as an offender.
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
        if (/^\|\s*"expire"\s*$/.test(trimmed)) return;
        if (/["']expire["']/.test(line)) {
          offenders.push(`${file.replace(join(__dirname, "..", ".."), "")}:${i + 1}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
