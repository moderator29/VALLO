import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NO `:has()` ON THE ROOT IN A SCREEN STYLESHEET.
 *
 * `:root:has(.x) .y`, `html:has(...)` and `body:has(...)` make Chrome re-check
 * the root on every DOM insertion that could touch the argument, and a root
 * anchor invalidates the whole document. On the live landing page (17 October
 * 2026, a 4x throttled phone) that was eight full-document style
 * recalculations in five seconds, 110 to 340ms each. The owner of the state
 * raises a root flag instead (`lib/ui/root-flag.ts`), and the rule reads
 * `:root[data-flag] .y`, which restyles only `.y`.
 *
 * Print sheets are exempt: `@media print` rules are not in the screen rule set
 * and never run on a phone. A local `:has()` on a component
 * (`.nf-srow__body:has(> .nf-srow__sub)`) is fine; only the root anchor is the
 * problem.
 */
const SRC = join(__dirname, "..");
const ROOTS = [SRC, join(SRC, "..", "..", "..", "packages", "design-tokens", "src")];
const SKIP_DIRS = new Set(["node_modules", ".next"]);
const PRINT_ONLY = new Set(["print.css"]);

function sheets(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sheets(path, out);
    else if (entry.name.endsWith(".css") && !PRINT_ONLY.has(entry.name)) out.push(path);
  }
  return out;
}

const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "");

describe("root :has()", () => {
  it("is absent from every screen stylesheet", () => {
    const files = ROOTS.flatMap((root) => sheets(root));
    expect(files.length).toBeGreaterThan(50);
    const offenders: string[] = [];
    for (const file of files) {
      const lines = strip(readFileSync(file, "utf8")).split("\n");
      lines.forEach((line, i) => {
        if (/(^|[\s,(>~+])(:root|html|body)(\[[^\]]*\])*:has\(/.test(line)) offenders.push(`${file.slice(SRC.length)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
