import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * B14: ONE HAPTIC GRAMMAR. Every haptic in the app goes through
 * `feedback()` in `lib/ui/feedback.ts`, whose five kinds keep "success" for
 * money and confirmed viewings. A direct `nativeHaptic(` or
 * `navigator.vibrate(` anywhere else would be a second grammar.
 */
const SRC = join(__dirname, "..", "..");
const ALLOWED = new Set(["lib/ui/feedback.ts"]);

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

describe("haptic grammar (B14)", () => {
  it("finds no haptic outside lib/ui/feedback.ts", () => {
    const hits = files(SRC).flatMap((path) => {
      const rel = relative(SRC, path).split("\\").join("/");
      if (ALLOWED.has(rel)) return [];
      const source = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      return /\bnativeHaptic\(|navigator\.vibrate\??\.?\(/.test(source) ? [rel] : [];
    });
    expect(hits).toEqual([]);
  });
});
