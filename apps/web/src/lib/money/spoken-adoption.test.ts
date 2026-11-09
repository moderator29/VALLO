import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * B15: NO COMPACT FIGURE IN THE MEMBER APP IS PRINTED WITHOUT ITS SPOKEN FORM.
 *
 * A compact figure ("₦2.8m") is read aloud as "naira two point eight m".
 * `<Money>` and `<Amount>` carry a visually hidden spoken form beside it, so
 * a member-app component must reach compact money through one of them, never
 * by calling `formatMoney(..., { compact: true })` or `formatMoneyGlance(...)`
 * into its own markup.
 */
const ROOTS = [join(__dirname, "..", "..", "components", "app"), join(__dirname, "..", "..", "app", "(app)")];

function tsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) tsx(path, out);
    /* An `opengraph-image.tsx` renders a static social-share picture through
       Satori (`next/og`), never screen-reader markup, so there is no place for
       a spoken form beside its compact figure; the rule does not reach it. */
    else if (name.endsWith(".tsx") && !name.includes(".test.") && name !== "opengraph-image.tsx") out.push(path);
  }
  return out;
}

describe("spoken money adoption (B15)", () => {
  it("finds no compact money printed straight into member-app markup", () => {
    const hits = ROOTS.flatMap((root) => tsx(root)).flatMap((path) => {
      const source = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      return /compact:\s*true|formatMoneyGlance\(/.test(source) ? [relative(join(__dirname, "..", ".."), path)] : [];
    });
    expect(hits).toEqual([]);
  });
});
