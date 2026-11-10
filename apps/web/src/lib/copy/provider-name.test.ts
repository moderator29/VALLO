import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE RETIRED PAYMENT PROVIDER IS GONE FROM THE PLATFORM (founder, 10 November
 * 2026: "Remove it. We are not using them in our platform no more.").
 *
 * No source file under apps/web/src and packages may carry its name, in copy,
 * comments, identifiers, file names or routes, except lines that carry the
 * marker `legacy-name`: the old live flag key and the old deploy setting,
 * still read for compatibility until the next deploy settings change and the
 * pending removal SQL have both landed. This file is exempt because it must
 * say the word to look for it.
 */
const SRC = join(__dirname, "..", "..");
const PACKAGES = join(SRC, "..", "..", "..", "packages");
const WORD = new RegExp(["pay", "luk"].join(""), "i");
const THIS_FILE = "lib/copy/provider-name.test.ts";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === "node_modules" || name === ".next") return [];
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx|css|json|mjs|md)$/.test(name) ? [full] : [];
  });
}

describe("the retired payment provider is not named anywhere in the source", () => {
  it("finds the name in no file, line or file name except the marked compatibility lines", () => {
    const found: string[] = [];
    for (const root of [SRC, PACKAGES]) {
      for (const file of files(root)) {
        const at = relative(root, file).split("\\").join("/");
        if (root === SRC && at === THIS_FILE) continue;
        if (WORD.test(at)) found.push(`${at}: file name`);
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (WORD.test(line) && !line.includes("legacy-name")) found.push(`${at}:${i + 1}: ${line.trim().slice(0, 100)}`);
          });
      }
    }
    expect(found).toEqual([]);
  });

  it("keeps the marked compatibility lines to the two known ones, both in the protected-pay switch", () => {
    const marked: string[] = [];
    for (const file of files(SRC)) {
      const at = relative(SRC, file).split("\\").join("/");
      if (at === THIS_FILE) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line) => {
          if (WORD.test(line) && line.includes("legacy-name")) marked.push(at);
        });
    }
    expect(marked.sort()).toEqual([
      "lib/money/member-wallet.ts",
      "lib/money/protected-pay-switch.ts",
      "lib/money/protected-pay-switch.ts",
    ]);
  });

  it("has no route under app/api whose path names it", () => {
    const routes = files(join(SRC, "app", "api"))
      .map((f) => relative(SRC, f).split("\\").join("/"))
      .filter((f) => WORD.test(f));
    expect(routes).toEqual([]);
  });
});
