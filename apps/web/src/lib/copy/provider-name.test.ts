import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE PAYMENTS PARTNER IS NEVER NAMED TO A MEMBER (founder, 29 October 2026:
 * "nothing shown to our users that it is held by Payluk"). Member-facing text
 * says "our licensed provider". The name stays in code identifiers,
 * the provider adapters, the webhook, the staff-only admin console and the
 * development harness, none of which a member reads.
 */
const SRC = join(__dirname, "..", "..");
const STAFF_OR_INTERNAL = [
  /^app\/admin\//,
  /^app\/\(dev\)\//,
  /^app\/api\//,
  /^lib\/admin\//,
  /^lib\/payments\//,
  /^lib\/payouts\//,
  /^lib\/trust\/claims\.ts$/,
  /\.test\.tsx?$/,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : files(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("member copy never names the payments partner", () => {
  it("finds no string literal that says Payluk outside the staff and internal trees", () => {
    const found: string[] = [];
    for (const file of files(SRC)) {
      const at = relative(SRC, file).split("\\").join("/");
      if (STAFF_OR_INTERNAL.some((tree) => tree.test(at))) continue;
      let block = false;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const t = line.trim();
          if (t.includes("/*") && !t.includes("*/")) block = true;
          if (block) {
            if (t.includes("*/")) block = false;
            return;
          }
          if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
          const code = line.split(" //")[0] ?? line;
          /* JSX text is not a string literal: a line of a .tsx file that is plain words (no quote, no brace, no tag) and says Payluk is member-facing text. */
          if (at.endsWith(".tsx") && /\bPayluk\b/.test(code) && !/["'`{}=<>;()]/.test(code.replace(/<[^>]*>/g, ""))) {
            found.push(`${at}:${i + 1}: ${t.slice(0, 100)}`);
          }
          if (/["'`][^"'`]*Payluk[^"'`]*["'`]/.test(code) && !/\b(Payluk[A-Z]\w*|payluk)\b/.test(code.replace(/["'`][^"'`]*["'`]/g, ""))) {
            found.push(`${at}:${i + 1}: ${t.slice(0, 100)}`);
          }
        });
    }
    expect(found).toEqual([]);
  });
});
