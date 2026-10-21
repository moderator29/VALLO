import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { requestNow } from "./when";

/**
 * The request's clock has one definition (`lib/format/when.ts`). Six pages
 * and two libraries each wrote their own; a second copy is how two halves of
 * one page come to disagree about "now".
 */

const SRC = join(__dirname, "..", "..");

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

describe("requestNow", () => {
  it("reads the clock", () => {
    const before = Date.now();
    const now = requestNow();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it("is defined once, in lib/format/when.ts", () => {
    const defining = sources(SRC).filter((path) => /function requestNow\s*\(/.test(readFileSync(path, "utf8")));
    expect(defining.map((path) => path.slice(SRC.length + 1))).toEqual(["lib/format/when.ts"]);
  });
});
